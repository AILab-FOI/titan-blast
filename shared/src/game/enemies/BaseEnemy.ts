// shared/src/game/enemies/BaseEnemy.ts - Complete server-side implementation

import type * as RAPIER from '@dimforge/rapier2d-compat';
import { MovableEntity } from '../MovableEntity';
import { ArmorProvider, Damageable } from '../Interfaces';
import { Position } from '../Position';
import { GameEventEmitter } from '../events/GameEventEmitter';
import {
   EnemyAbilityType,
   EnemyAnimationState,
   EnemyNetworkData,
   EnemyProperties,
   EnemyType,
   IAIBehavior,
   IEnemyAbility,
} from './EnemyInterfaces';
import { EnemyDamageEvent, EnemyDeathEvent } from '../events/events/EnemyEvents';
import { ITargetable, TargetFinder, TargetingStrategy } from './EnemyTargetSystem';
import { pixelToPhysics } from '../../util/Utils';
import { CollisionGroups } from '../CollisionSettings';
import { SteeringController } from './steering/SteeringController';
import { gameSettings } from '../SystemSettings';
import { IPathfindingService } from './interfaces/IPathfindingService';

export abstract class BaseEnemy extends MovableEntity implements Damageable, ArmorProvider {
   // Damageable interface implementation
   public health: number;
   public readonly maxHealth: number;

   // Core enemy properties
   public readonly enemyType: EnemyType;
   public readonly properties: EnemyProperties;
   public readonly level: number;

   // Combat properties
   private lastAttackTime: number = 0;

   private currentTarget: ITargetable | null = null;

   // AI and behavior
   private aiBehavior: IAIBehavior | null = null;
   private abilities: Map<EnemyAbilityType, IEnemyAbility> = new Map();
   private lastAbilityUsage: Map<EnemyAbilityType, number> = new Map();

   // Animation state
   private currentAnimationState: EnemyAnimationState = EnemyAnimationState.IDLE;

   // Dirty flagging for network updates
   private isDirty: boolean = false;
   private dirtyFields: Set<keyof EnemyNetworkData> = new Set();

   protected steeringController: SteeringController | null = null;

   private pathfindingService: IPathfindingService | null = null;

   constructor(
      world: RAPIER.World,
      rapier: typeof RAPIER,
      enemyType: EnemyType,
      properties: EnemyProperties,
      level: number = 1,
      id?: string,
   ) {
      super(world, rapier, id);

      this.enemyType = enemyType;
      this.properties = properties;
      this.level = level;

      // Scale health based on level
      this.maxHealth = Math.floor(properties.maxHealth * (1 + (level - 1) * 0.2));
      this.health = this.maxHealth;
   }

   public setPathfindingService(service: IPathfindingService): void {
      this.pathfindingService = service;
   }

   protected getPathfindingService(): IPathfindingService | null {
      return this.pathfindingService;
   }

   /**
    * Create the physics body for this enemy
    */
   protected createBody(position: Position, rotation: number): RAPIER.RigidBody {
      // Create rigid body
      const bodyDesc = this.rapier.RigidBodyDesc.dynamic()
         .setTranslation(pixelToPhysics(position.x), pixelToPhysics(position.y))
         .setRotation(rotation)
         .setLinearDamping(this.properties.physics.linearDamping)
         .setAngularDamping(this.properties.physics.angularDamping)
         .setCcdEnabled(true)
         .lockRotations();

      const body = this.world.createRigidBody(bodyDesc);

      // Create collider
      const colliderDesc = this.rapier.ColliderDesc.cuboid(
         pixelToPhysics(this.properties.physics.dimensions.width / 2),
         pixelToPhysics(this.properties.physics.dimensions.height / 2),
      )
         // .setMass(this.properties.physics.mass)
         .setFriction(this.properties.physics.friction)
         .setRestitution(this.properties.physics.restitution)
         .setCollisionGroups(CollisionGroups.Enemy);

      this.world.createCollider(colliderDesc, body);

      return body;
   }

   /**
    * Main update method - called every tick but only handles basic updates
    */
   public update(deltaTime: number, currentTime: number): void {
      // Only handle animation state updates here
      // Movement, targeting, and abilities are handled by scheduled tasks
      this.updateAnimationState();
   }

   /**
    * Movement task - move towards current target if available
    * Updated to work with fully async pathfinding system
    */
   public performMovement(): void {
      if (!this.currentTarget) {
         return;
      }

      const shortId = this.id.substring(0, 8);
      const distance = this.getDistanceToTarget(this.currentTarget);

      const deltaTimeSeconds = gameSettings.enemyMovementDeltaTime;

      // console.log(
      //    `🏃 [${shortId}] Movement check: distance=${distance.toFixed(1)}, range=${this.properties.detectionRange}`,
      // );

      // Check if target is still in range
      if (distance > this.properties.detectionRange) {
         // console.log(`   ❌ [${shortId}] Target out of range - clearing`);
         this.setTarget(null);
         return;
      }

      const pathfindingManager = this.getPathfindingService();

      if (pathfindingManager) {
         const targetPosition = this.currentTarget.getCurrentPosition();

         // Get actual enemy size from physics dimensions
         // const enemySize = Math.max(
         //    this.properties.physics.dimensions.width,
         //    this.properties.physics.dimensions.height,
         // );

         // console.log(`   🔍 [${shortId}] Requesting pathfinding (size: ${enemySize})`);

         // This now works with async pathfinding - returns immediately with current best path
         const nextTarget = pathfindingManager.requestPath(
            this.id,
            this.position,
            targetPosition,
            this.properties.physics.dimensions.width,
            this.properties.physics.dimensions.height,
         );

         if (nextTarget) {
            // console.log(
            //    `   ✅ [${shortId}] Moving to pathfinding target: (${nextTarget.x.toFixed(1)}, ${nextTarget.y.toFixed(1)})`,
            // );
            this.moveTowardsWithForce(nextTarget, deltaTimeSeconds);
         } else {
            // console.log(`   ❌ [${shortId}] No pathfinding target available`);

            // Enhanced fallback logic
            const directDistance = this.getDistanceToTarget(this.currentTarget);
            // console.log(`   📏 [${shortId}] Direct distance: ${directDistance.toFixed(1)}`);

            if (directDistance < 150) {
               // Close enough for direct movement
               // console.log(`   🎯 [${shortId}] Using direct movement (close)`);
               this.moveTowardsWithForce(targetPosition, deltaTimeSeconds);
            } else if (directDistance < 300) {
               // Medium distance - try line of sight
               if (
                  pathfindingManager.hasLineOfSight &&
                  pathfindingManager.hasLineOfSight(this.position, targetPosition)
               ) {
                  // console.log(`   👁️ [${shortId}] Using direct movement (line of sight)`);
                  this.moveTowardsWithForce(targetPosition, deltaTimeSeconds);
               } else {
                  // console.log(`   🚫 [${shortId}] No line of sight - waiting for pathfinding`);
                  // Don't move, let async pathfinding work
               }
            } else {
               // console.log(`   ❌ [${shortId}] Too far and no path - clearing target`);
               this.setTarget(null);
            }
         }
      } else {
         // console.log(`   ⚠️ [${shortId}] No pathfinding manager - using AI fallback`);
         // Fallback behavior
         if (this.aiBehavior) {
            this.aiBehavior.updateWithTarget(this, 40, this.currentTarget);
         }
      }
   }

   /**
    * Set available entities for targeting (called by EnemyManager)
    */
   public updateTargeting(availableEntities: { players: any[]; structures?: any[] }): void {
      const newTarget = this.findTarget(availableEntities);

      // Only change target if new one is significantly better
      if (this.shouldSwitchTarget(newTarget)) {
         this.setTarget(newTarget);
      }
   }

   /**
    * Ability task - check and use abilities
    */
   public performAbilities(): void {
      if (!this.currentTarget) return;

      const distance = this.getDistanceToTarget(this.currentTarget);

      // Try to attack if in range
      if (distance <= this.properties.attackRange) {
         this.attackTarget(this.currentTarget);
      }

      // Check other abilities
      for (const [abilityType, ability] of this.abilities) {
         if (ability.canUse(this)) {
            ability.execute(this, this.currentTarget);
         }
      }
   }

   /**
    * Apply force-based movement towards a target position
    * Updated to work better with pathfinding waypoints
    */
   public moveTowardsWithForce(targetPosition: Position, deltaTimeMS: number): void {
      const dx = targetPosition.x - this.position.x;
      const dy = targetPosition.y - this.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
         const normalizedX = dx / distance;
         const normalizedY = dy / distance;

         // Calculate base movement force - now properly scaled per second
         const moveSpeed = this.properties.movementSpeed * (1 + (this.level - 1) * 0.1);

         const baseForce = {
            x: normalizedX * moveSpeed * deltaTimeMS,
            y: normalizedY * moveSpeed * deltaTimeMS,
         };

         // Apply steering if available
         if (this.steeringController && this.steeringController.isEnabled()) {
            const nearbyEnemies = this.getNearbyEnemies();
            const steering = this.steeringController.calculateSteering(this, nearbyEnemies, targetPosition, Date.now());

            // Combine base movement with steering - steering should also be delta-time aware
            const finalForce = {
               x: baseForce.x + steering.x * deltaTimeMS,
               y: baseForce.y + steering.y * deltaTimeMS,
            };

            this.applyForce(finalForce);
         } else {
            // Use original movement if no steering
            this.applyForce(baseForce);
         }

         // Mark as dirty for network updates
         this.markDirty('position');
      }
   }

   /**
    * Get targeting strategy for this enemy type
    */
   protected abstract getTargetingStrategy(): TargetingStrategy;

   /**
    * Find target based on enemy's strategy
    */
   public findTarget(availableEntities: { players: any[]; structures?: any[] }): ITargetable | null {
      const strategy = this.getTargetingStrategy();

      return TargetFinder.findTarget(strategy, this.position, this.properties.detectionRange, availableEntities);
   }

   /**
    * Determine if we should switch to a new target
    */
   private shouldSwitchTarget(newTarget: ITargetable | null): boolean {
      // No current target - take any new target
      if (!this.currentTarget) {
         return newTarget !== null;
      }

      // No new target - keep current if still in range
      if (!newTarget) {
         const distance = this.getDistanceToTarget(this.currentTarget);
         return distance > this.properties.detectionRange;
      }

      // Compare current vs new target
      const strategy = this.getTargetingStrategy();

      if (strategy === TargetingStrategy.CLOSEST_PLAYER || strategy === TargetingStrategy.CLOSEST_ANY) {
         // Distance-based: switch if new target is significantly closer
         const distanceToCurrent = this.getDistanceToTarget(this.currentTarget);
         const distanceToNew = this.getDistanceToTarget(newTarget);
         return distanceToNew < distanceToCurrent * 0.8; // 20% closer
      }

      if (strategy === TargetingStrategy.PRIORITY_PLAYER || strategy === TargetingStrategy.PRIORITY_ANY) {
         // Priority-based: switch if new target has significantly higher priority
         return newTarget.targetPriority > this.currentTarget.targetPriority * 1.2; // 20% higher
      }

      return false;
   }

   /**
    * Set the current target (updated to use ITargetable)
    */
   public setTarget(target: ITargetable | null): void {
      // console.log(`Enemy '${this.id}' has targeted player ${target?.id} who is at ${target?.getCurrentPosition()}`);
      this.currentTarget = target;
   }

   /**
    * Get the current target (updated to return ITargetable)
    */
   public getTarget(): ITargetable | null {
      return this.currentTarget;
   }

   /**
    * Get distance to a target
    */
   public getDistanceToTarget(target: ITargetable): number {
      const targetPosition = target.getCurrentPosition();
      const dx = this.position.x - targetPosition.x;
      const dy = this.position.y - targetPosition.y;
      return Math.sqrt(dx * dx + dy * dy);
   }

   /**
    * Attempt to attack a target
    */
   public attackTarget(target: ITargetable): boolean {
      const currentTime = Date.now();

      if (currentTime - this.lastAttackTime < this.properties.attackCooldown) {
         return false; // Still on cooldown
      }

      const distance = this.getDistanceToTarget(target);
      if (distance > this.properties.attackRange) {
         return false; // Target out of range
      }

      // Perform attack
      this.performAttack(target);
      this.lastAttackTime = currentTime;
      this.setAnimationState(EnemyAnimationState.ATTACK);

      return true;
   }

   /**
    * Use a specific ability
    */
   public useAbility(abilityType: EnemyAbilityType, target?: ITargetable): boolean {
      const ability = this.abilities.get(abilityType);
      if (!ability) return false;

      const currentTime = Date.now();
      const lastUsed = this.lastAbilityUsage.get(abilityType) || 0;

      if (currentTime - lastUsed < ability.cooldown) {
         return false; // Still on cooldown
      }

      if (!ability.canUse(this)) {
         return false; // Cannot use ability
      }

      const success = ability.execute(this, target || this.currentTarget);
      if (success) {
         this.lastAbilityUsage.set(abilityType, currentTime);
         this.setAnimationState(EnemyAnimationState.ABILITY);
      }

      return success;
   }

   /**
    * Set the AI behavior for this enemy
    */
   public setAIBehavior(behavior: IAIBehavior): void {
      this.aiBehavior = behavior;
   }

   /**
    * Add an ability to this enemy
    */
   public addAbility(ability: IEnemyAbility): void {
      this.abilities.set(ability.type, ability);
      this.lastAbilityUsage.set(ability.type, 0);
   }

   /**
    * Update animation state based on current movement
    */
   private updateAnimationState(): void {
      const velocity = this.velocity;
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

      if (speed > 10) {
         this.setAnimationState(EnemyAnimationState.MOVE);
      } else {
         this.setAnimationState(EnemyAnimationState.IDLE);
      }
   }

   /**
    * Set the enemy's animation state
    */
   public setAnimationState(state: EnemyAnimationState): void {
      if (this.currentAnimationState !== state) {
         this.currentAnimationState = state;
         this.markDirty('animationState');
         this.onAnimationStateChanged(state);
      }
   }

   /**
    * Get the current animation state
    */
   public getAnimationState(): EnemyAnimationState {
      return this.currentAnimationState;
   }

   // Dirty flagging for network updates
   private markDirty(field: keyof EnemyNetworkData): void {
      this.isDirty = true;
      this.dirtyFields.add(field);
   }

   public isDirtyForNetworkUpdate(): boolean {
      return this.isDirty;
   }

   public serializeDelta(): Partial<EnemyNetworkData> | null {
      if (!this.isDirty) return null;

      const deltaData: Partial<EnemyNetworkData> = { id: this.id };

      for (const field of this.dirtyFields) {
         switch (field) {
            case 'position':
               deltaData.position = { ...this.position };
               break;
            case 'rotation':
               deltaData.rotation = this.rotationDegrees;
               break;
            case 'animationState':
               deltaData.animationState = this.currentAnimationState;
               break;
            case 'targetId':
               deltaData.targetId = this.currentTarget?.id;
               break;
         }
      }

      return deltaData;
   }

   public clearDirtyFlags(): void {
      this.isDirty = false;
      this.dirtyFields.clear();
   }

   /**
    * Handle enemy death
    */
   private die(): void {
      // ✅ Capture position BEFORE despawning the physics body
      const deathPosition = { ...this.position };

      // ✅ Pass the captured position to the event constructor
      GameEventEmitter.getInstance().emit(new EnemyDeathEvent(this, this.properties.scoreValue, deathPosition));

      // Remove from world
      this.despawn();
   }

   /**
    * Serialize enemy data for network transmission
    */
   public serialize(): EnemyNetworkData {
      return {
         id: this.id,
         position: { ...this.position },
         rotation: this.rotationDegrees,
         animationState: this.currentAnimationState,
         targetId: this.currentTarget?.id,
         lastAttackTime: this.lastAttackTime,
      };
   }

   // Abstract methods to be implemented by concrete enemies
   protected abstract performAttack(target: ITargetable): void;

   protected abstract onAnimationStateChanged(newState: EnemyAnimationState): void;

   public setSteeringController(controller: SteeringController): void {
      this.steeringController = controller;
   }

   /**
    * Get steering controller
    */
   public getSteeringController(): SteeringController | null {
      return this.steeringController;
   }

   /**
    * Get nearby enemies for steering calculations
    * This will be implemented by the EnemyManager
    */
   protected getNearbyEnemies(): BaseEnemy[] {
      // This will be overridden or injected by EnemyManager
      return [];
   }

   /**
    * Get AI behavior (add this getter if it doesn't exist)
    */
   public getAIBehavior(): IAIBehavior | null {
      return this.aiBehavior;
   }

   /**
    * ArmorProvider interface implementation
    * Provides standardized access to armor values for damage calculation
    */
   public getArmor(): number {
      return this.properties.armor;
   }

   /**
    * Damageable interface implementation with armor consideration
    */
   public takeDamage(amount: number, source?: any): void {
      // Note: Armor reduction is now handled by DamageCalculationService
      // This method should receive the final damage amount after all calculations

      this.health = Math.max(0, this.health - amount);

      // Emit damage event
      GameEventEmitter.getInstance().emit(new EnemyDamageEvent(this, amount, source));

      // Notify AI behavior
      if (this.aiBehavior && this.aiBehavior.onDamaged) {
         this.aiBehavior.onDamaged(this, amount, source);
      }

      // Check for death
      if (this.health <= 0) {
         // Capture position BEFORE any cleanup happens
         const deathPosition = { ...this.position };

         // Emit death event and let EnemyManager handle all cleanup
         GameEventEmitter.getInstance().emit(new EnemyDeathEvent(this, this.properties.scoreValue, deathPosition));
      }
   }

   /**
    * Get current target for AI and damage calculations
    */
   public getCurrentTarget(): ITargetable | null {
      return this.currentTarget;
   }
}
