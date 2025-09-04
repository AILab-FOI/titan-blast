// client/src/game/enemies/ClientEnemy.ts

import { EnemyAnimationState, EnemyNetworkData, EnemyProperties, EnemyType } from 'shared/game/enemies/EnemyInterfaces';
import { Position } from 'shared/game/Position';
import {
   AnimatedEntityConfig,
   AnimatedEntityRenderComponent,
} from '../rendering/animation/AnimatedEntityRenderComponent';
import { InterpolatedEntity, InterpolationComponent } from '../rendering/interpolation/InterpolationComponent';
import { EntityShape } from 'shared/game/PlayerTypes';
import { MovableEntity } from 'shared/game/MovableEntity';
import { pixelToPhysics } from 'shared/util/Utils';
import { CollisionGroups } from 'shared/game/CollisionSettings';
import type * as RAPIER from '@dimforge/rapier2d-compat';
import { EnemyFactory } from 'shared/game/enemies/ConcreteEnemies';
import { BaseEnemy } from 'shared/game/enemies/BaseEnemy';
import FrontendGame from '../FrontendGame';
import { calculateHealthbarOffset, createHealthbar, SegmentedHealthbar } from '../ui/SegmentedHealthbar';

/**
 * Direction the enemy is facing for texture flipping
 */
enum FacingDirection {
   RIGHT = 1, // Default direction (east) - no flip needed
   LEFT = -1, // Facing left (west) - needs horizontal flip
}

/**
 * Client-side enemy using kinematic physics bodies
 * Handles rendering, interpolation, collision detection, animations, and directional facing
 */
export class ClientEnemy extends MovableEntity implements InterpolatedEntity {
   // Enemy instance (composition - contains actual BaseEnemy instance)
   public enemyInstance: BaseEnemy;
   private game: FrontendGame;

   // Rendering and interpolation components
   public renderComponent!: AnimatedEntityRenderComponent;
   public interpolationComponent!: InterpolationComponent;

   // Animation state tracking
   private currentAnimationState: EnemyAnimationState = EnemyAnimationState.IDLE;

   // Server state tracking for interpolation
   private serverPositionHistory: Array<{ position: Position; timestamp: number }> = [];
   private lastUpdateTime: number = 0;

   private visualPosition: Position;
   private visualRotation: number;

   private currentFacingDirection: FacingDirection = FacingDirection.RIGHT;
   private lastKnownTargetPosition: Position | null = null;

   private currentTargetId: string | null = null;
   private currentTargetPosition: Position | null = null;

   private healthbar?: SegmentedHealthbar;

   // Convenience accessors to enemy properties
   public get enemyType(): EnemyType {
      return this.enemyInstance.enemyType;
   }

   public get level(): number {
      return this.enemyInstance.level;
   }

   public get properties(): EnemyProperties {
      return this.enemyInstance.properties;
   }

   public get health(): number {
      return this.enemyInstance.health;
   }

   public get maxHealth(): number {
      return this.enemyInstance.maxHealth;
   }

   constructor(
      world: RAPIER.World,
      rapier: typeof RAPIER,
      id: string,
      enemyType: EnemyType,
      level: number,
      position: Position,
      rotation: number,
      parentContainer: any,
      assetLoader: any,
      gameInstance: any,
   ) {
      super(world, rapier, id);

      // Create the actual BaseEnemy instance using the factory
      this.enemyInstance = EnemyFactory.createEnemy(enemyType, world, rapier, level);

      this.visualPosition = { ...position };
      this.visualRotation = rotation;

      this.game = gameInstance;

      // Setup rendering
      this.setupRendering(enemyType, parentContainer, assetLoader, position, rotation);

      // Spawn the enemy (creates kinematic physics body)
      this.spawn(position, rotation);

      // console.log(`✅ Created ClientEnemy ${id} (${enemyType}) with kinematic body and animation system`);
   }

   private setupRendering(
      enemyType: EnemyType,
      parentContainer: any,
      assetLoader: any,
      position: Position,
      rotation: number,
   ): void {
      // Get enemy textures from asset loader
      const enemyTextures = assetLoader.getEnemyTextures(enemyType);
      if (!enemyTextures) {
         throw new Error(`Failed to load textures for enemy type: ${enemyType}`);
      }

      // Create render config
      const renderConfig: AnimatedEntityConfig = {
         shape: EntityShape.Cuboid,
         dimensions: {
            width: this.properties.physics.dimensions.width,
            height: this.properties.physics.dimensions.height,
         },
         animationFrameRates: this.properties.animationFrameRates,
      };

      this.renderComponent = new AnimatedEntityRenderComponent(enemyTextures, renderConfig, 'enemy');

      // Add to scene
      parentContainer.addChild(this.renderComponent.getContainer());

      this.healthbar = createHealthbar(
         this.maxHealth,
         this.renderComponent.getContainer(), // Attaches to enemy's container
         {
            showNumbers: false,
            offset: calculateHealthbarOffset(this.properties.physics.dimensions), // Dynamic offset based on enemy height
         },
      );

      // Initialize position and rotation
      this.renderComponent.updatePosition(position.x, position.y);
      this.renderComponent.updateRotation(rotation);

      // Create interpolation component
      this.interpolationComponent = new InterpolationComponent(this, true);
   }

   /**
    * Create kinematic physics body for collision detection (from MovableEntity)
    */
   protected createBody(position: Position, rotation: number): RAPIER.RigidBody {
      // Create kinematic position-based body - no physics simulation, but has collision detection
      const bodyDesc = this.rapier.RigidBodyDesc.kinematicPositionBased()
         .setTranslation(pixelToPhysics(position.x), pixelToPhysics(position.y))
         .setRotation(rotation)
         .setCcdEnabled(true);

      const body = this.world.createRigidBody(bodyDesc);

      // Create collider for collision detection
      const colliderDesc = this.rapier.ColliderDesc.cuboid(
         pixelToPhysics(this.properties.physics.dimensions.width / 2),
         pixelToPhysics(this.properties.physics.dimensions.height / 2),
      ).setCollisionGroups(CollisionGroups.Enemy);

      this.world.createCollider(colliderDesc, body);

      return body;
   }

   public onInterpolatedUpdate(position: Position, rotation: number): void {
      // Update visual rendering with interpolated values
      this.renderComponent.updatePosition(position.x, position.y);
      this.renderComponent.updateRotation(rotation);

      this.visualPosition = { ...position };
      this.visualRotation = rotation;
   }

   public getCurrentPosition(): Position {
      return { ...this.visualPosition };
   }

   public getCurrentRotation(): number {
      return this.visualRotation;
   }

   /**
    * Update client enemy (called every render frame)
    */
   public update(): void {
      // Update animation state based on interpolated movement
      this.updateAnimationState();

      this.updateFacingDirection();

      // Update interpolation (handles smooth movement between server updates)
      this.interpolationComponent.update();

      this.renderComponent.update();
   }

   /**
    * Update animation state based on current interpolated movement
    */
   private updateAnimationState(): void {
      // Calculate movement speed from interpolation velocity
      const speed = this.getInterpolatedMovementSpeed();
      const newState = speed > 10 ? EnemyAnimationState.MOVE : EnemyAnimationState.IDLE;

      if (this.currentAnimationState !== newState) {
         this.currentAnimationState = newState;
         this.renderComponent.setAnimation(newState);
      }
   }

   private updateFacingDirection(): void {
      // Performance optimization: only check every 20 frames
      if (this.game.getPhysicsManager().getGameTick() % 20 !== 0) {
         return;
      }

      let targetPosition: Position | null = null;

      // Get fresh target position if we have a target
      if (this.currentTargetId && this.game) {
         const playerManager = this.game.getPlayerManager();
         if (playerManager) {
            const player = playerManager.getPlayerById(this.currentTargetId);
            if (player && player.position) {
               targetPosition = player.position;
               // Update our cached position
               this.currentTargetPosition = { ...targetPosition };
            }
         }
      }

      // Use current target position (either fresh or cached)
      if (targetPosition || this.currentTargetPosition) {
         const positionToUse = targetPosition || this.currentTargetPosition!;

         // Calculate direction to target
         const deltaX = positionToUse.x - this.visualPosition.x;
         const newFacingDirection = deltaX >= 0 ? FacingDirection.RIGHT : FacingDirection.LEFT;

         // Update sprite flipping if direction changed
         if (newFacingDirection !== this.currentFacingDirection) {
            this.currentFacingDirection = newFacingDirection;
            this.updateSpriteFlipping();
         }

         // Update last known position
         this.lastKnownTargetPosition = { ...positionToUse };
      }
      // If no target and no last known position, keep facing right (default)
   }

   /**
    * NEW: Update sprite flipping based on facing direction
    */
   private updateSpriteFlipping(): void {
      const sprite = this.renderComponent.getSprite();

      if (this.currentFacingDirection === FacingDirection.LEFT) {
         // Facing left - flip horizontally
         sprite.scale.x = -Math.abs(sprite.scale.x);
      } else {
         // Facing right - normal orientation
         sprite.scale.x = Math.abs(sprite.scale.x);
      }
   }

   /**
    * Get interpolated movement speed for animation purposes
    */
   private getInterpolatedMovementSpeed(): number {
      if (this.serverPositionHistory.length < 2) {
         return 0;
      }

      const recent = this.serverPositionHistory[this.serverPositionHistory.length - 1];
      const previous = this.serverPositionHistory[this.serverPositionHistory.length - 2];

      const timeDelta = (recent.timestamp - previous.timestamp) / 1000; // Convert to seconds
      if (timeDelta <= 0) return 0;

      const distance = Math.sqrt(
         Math.pow(recent.position.x - previous.position.x, 2) + Math.pow(recent.position.y - previous.position.y, 2),
      );

      return distance / timeDelta; // pixels per second
   }

   private updateTargetFromNetworkData(targetId?: string): void {
      if (targetId !== this.currentTargetId) {
         if (targetId) {
            // console.log(`Enemy ${this.id} now targeting: ${targetId}`);
            this.currentTargetId = targetId;
            this.updateTargetPositionFromEntityId(targetId);
         } else {
            console.log(`Enemy ${this.id} lost target: ${this.currentTargetId}`);
            this.currentTargetId = null;
            this.currentTargetPosition = null;
         }
      }
   }

   private updateTargetPositionFromEntityId(targetId: string): void {
      // Try player manager first (most common target)
      const playerManager = this.game.getPlayerManager();
      if (playerManager) {
         const player = playerManager.getPlayerById(targetId);
         if (player && player.position) {
            this.currentTargetPosition = { ...player.position };
            return;
         }
      }

      // Try entity manager
      const entityManager = this.game.getEntityManager();
      if (entityManager) {
         const entity = entityManager.getEntityById(targetId);
         if (entity && entity.position) {
            this.currentTargetPosition = { ...entity.position };
            return;
         }
      }

      // Fallback: If we can't find the target immediately, it's okay
      // The position will be updated when the target moves or in the next update cycle
      console.log(`Could not immediately locate target ${targetId} for enemy ${this.id}`);
   }

   public updateTargetPosition(entityId: string, position: Position): void {
      if (this.currentTargetId === entityId) {
         this.currentTargetPosition = { ...position };
      }
   }

   public triggerAttackAnimation(): void {
      this.currentAnimationState = EnemyAnimationState.ATTACK;
      this.renderComponent.setAnimation(EnemyAnimationState.ATTACK);

      console.log(`Enemy ${this.id} triggered attack animation`);
   }

   public triggerAbilityAnimation(): void {
      this.currentAnimationState = EnemyAnimationState.ABILITY;
      this.renderComponent.setAnimation(EnemyAnimationState.ABILITY);

      console.log(`Enemy ${this.id} triggered ability animation`);
   }

   public getFacingDirection(): string {
      return this.currentFacingDirection === FacingDirection.RIGHT ? 'RIGHT' : 'LEFT';
   }

   public getTargetInfo(): { hasTarget: boolean; targetId?: string; targetPosition?: Position } {
      return {
         hasTarget: this.currentTargetId !== null,
         targetId: this.currentTargetId || undefined,
         targetPosition: this.currentTargetPosition || undefined,
      };
   }

   public updateFromServer(data: Partial<EnemyNetworkData>): void {
      if (data.position) {
         this.updateKinematicPosition(data.position);
      }

      if (data.rotation !== undefined) {
         // If position wasn't updated, just update rotation interpolation
         if (!data.position) {
            this.interpolationComponent.updateState(this.getCurrentPosition(), data.rotation);
         }
         // If position was updated, rotation is already handled in updateKinematicPosition
      }

      // if (data.health !== undefined) {
      //    this.updateHealth(data.health, data.maxHealth || this.maxHealth);
      // }

      if (data.targetId !== undefined) {
         this.updateTargetFromNetworkData(data.targetId);
      }

      if (data.animationState && data.animationState !== this.currentAnimationState) {
         this.currentAnimationState = data.animationState;
         this.renderComponent.setAnimation(data.animationState);
      }

      this.lastUpdateTime = performance.now();
   }

   private updateKinematicPosition(serverPosition: Position): void {
      // Store server position for interpolation history
      this.serverPositionHistory.push({
         position: { ...serverPosition },
         timestamp: performance.now(),
      });

      // Keep only recent history (last 5 updates for smooth interpolation)
      if (this.serverPositionHistory.length > 5) {
         this.serverPositionHistory.shift();
      }

      // Update physics body to new position (for collision detection)
      this.body.setNextKinematicTranslation({
         x: pixelToPhysics(serverPosition.x),
         y: pixelToPhysics(serverPosition.y),
      });

      // This ensures collision detection works with the server position
      this.setPosition(serverPosition);

      // Start interpolation from current VISUAL position to new server position
      this.interpolationComponent.updateState(serverPosition, this.rotationDegrees);
   }

   public updateHealth(newHealth: number, newMaxHealth?: number): void {
      const oldHealth = this.health;
      const oldMaxHealth = this.maxHealth;

      // Update enemy health
      this.enemyInstance.health = newHealth;
      // if (newMaxHealth !== oldMaxHealth) {
      //    this.enemyInstance.maxHealth = newMaxHealth;
      // }

      // Update healthbar with new values
      if (this.healthbar) {
         this.healthbar.updateHealth(newHealth, newMaxHealth);
      }

      const effectsManager = this.game.getEffectsManager();
      if (effectsManager) {
         const enemyContainer = this.renderComponent.getContainer();
         effectsManager.createHitmarker(enemyContainer);
      }

      // Trigger damage effects if health decreased
      if (newHealth < oldHealth) {
         this.onDamageReceived(oldHealth - newHealth);
      }
   }

   private onDamageReceived(damage: number): void {
      console.log(`${this.enemyType} took ${damage} damage`);
   }

   public playDeathAnimation(): void {
      this.renderComponent.setAnimation(EnemyAnimationState.IDLE);
   }

   public getPhysicsPosition(): Position {
      return { ...this.position }; // Uses MovableEntity's position getter
   }

   public getPhysicsRotation(): number {
      return this.rotationDegrees; // Uses MovableEntity's rotation getter
   }

   public destroy(): void {
      this.interpolationComponent.stopInterpolation();

      if (this.renderComponent.getContainer().parent) {
         // @ts-ignore
         this.renderComponent.getContainer().parent.removeChild(this.renderComponent.getContainer());
      }

      this.renderComponent.destroy();

      this.despawn();
   }
}
