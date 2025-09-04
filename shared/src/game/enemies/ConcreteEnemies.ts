// shared/src/game/enemies/ConcreteEnemies.ts

import type * as RAPIER from '@dimforge/rapier2d-compat';
import { BaseEnemy } from './BaseEnemy';
import { EnemyAbilityType, EnemyAnimationState, EnemyType } from './EnemyInterfaces';
import { EnemyTemplates } from './EnemyTemplates';
import { AIBehaviorFactory } from './ai/AIBehaviors';
import { EnemyAbilityFactory } from './abilities/EnemyAbilities';
import { EnemyAnimationChangeEvent, EnemyAttackEvent } from '../events/events/EnemyEvents';
import { GameEventEmitter } from '../events/GameEventEmitter';
import { TargetingStrategy } from './EnemyTargetSystem';

/**
 * Default basic enemy implementation
 */
export class DefaultEnemy extends BaseEnemy {
   constructor(world: RAPIER.World, rapier: typeof RAPIER, level: number = 1, id?: string) {
      const template = EnemyTemplates.getScaledTemplate(EnemyType.DEFAULT, level);
      super(world, rapier, EnemyType.DEFAULT, template, level, id);

      // Set up AI behavior
      const aiBehavior = AIBehaviorFactory.create(template.aiBehavior);
      this.setAIBehavior(aiBehavior);

      // Add abilities
      for (const abilityType of template.abilities) {
         const ability = EnemyAbilityFactory.create(abilityType);
         this.addAbility(ability);
      }
   }

   protected getTargetingStrategy(): TargetingStrategy {
      return TargetingStrategy.CLOSEST_PLAYER;
   }

   protected performAttack(target: any): void {
      const damage = this.properties.attackDamage * (1 + (this.level - 1) * 0.15);

      // Emit attack event
      GameEventEmitter.getInstance().emit(new EnemyAttackEvent(this, target, damage, 'melee'));

      // Apply damage to target
      if (target && typeof target.takeDamage === 'function') {
         target.takeDamage(damage, this);
      }
   }

   protected getAvailableTargets(): any[] {
      // This would be implemented by the game manager
      // For now, return empty array
      return [];
   }

   protected onAnimationStateChanged(newState: EnemyAnimationState): void {
      GameEventEmitter.getInstance().emit(
         new EnemyAnimationChangeEvent(this, this.getAnimationState().toString(), newState),
      );
   }
}

/**
 * Fast-moving enemy with low health
 */
export class SpeedyEnemy extends BaseEnemy {
   constructor(world: RAPIER.World, rapier: typeof RAPIER, level: number = 1, id?: string) {
      const template = EnemyTemplates.getScaledTemplate(EnemyType.SPEEDY, level);
      super(world, rapier, EnemyType.SPEEDY, template, level, id);

      const aiBehavior = AIBehaviorFactory.create(template.aiBehavior);
      this.setAIBehavior(aiBehavior);

      for (const abilityType of template.abilities) {
         const ability = EnemyAbilityFactory.create(abilityType);
         this.addAbility(ability);
      }
   }

   protected getTargetingStrategy(): TargetingStrategy {
      return TargetingStrategy.PRIORITY_PLAYER;
   }

   protected performAttack(target: any): void {
      const damage = this.properties.attackDamage * (1 + (this.level - 1) * 0.15);

      GameEventEmitter.getInstance().emit(new EnemyAttackEvent(this, target, damage, 'melee'));

      if (target && typeof target.takeDamage === 'function') {
         target.takeDamage(damage, this);
      }
   }

   protected getAvailableTargets(): any[] {
      return [];
   }

   protected onAnimationStateChanged(newState: EnemyAnimationState): void {
      GameEventEmitter.getInstance().emit(
         new EnemyAnimationChangeEvent(this, this.getAnimationState().toString(), newState),
      );
   }
}

/**
 * High health, slow-moving tank enemy
 */
export class TankyEnemy extends BaseEnemy {
   constructor(world: RAPIER.World, rapier: typeof RAPIER, level: number = 1, id?: string) {
      const template = EnemyTemplates.getScaledTemplate(EnemyType.TANKY, level);
      super(world, rapier, EnemyType.TANKY, template, level, id);

      const aiBehavior = AIBehaviorFactory.create(template.aiBehavior);
      this.setAIBehavior(aiBehavior);

      for (const abilityType of template.abilities) {
         const ability = EnemyAbilityFactory.create(abilityType);
         this.addAbility(ability);
      }
   }

   protected getTargetingStrategy(): TargetingStrategy {
      return TargetingStrategy.CLOSEST_PLAYER;
   }

   protected performAttack(target: any): void {
      const damage = this.properties.attackDamage * (1 + (this.level - 1) * 0.15);

      GameEventEmitter.getInstance().emit(new EnemyAttackEvent(this, target, damage, 'melee'));

      if (target && typeof target.takeDamage === 'function') {
         target.takeDamage(damage, this);
      }
   }

   protected getAvailableTargets(): any[] {
      return [];
   }

   protected onAnimationStateChanged(newState: EnemyAnimationState): void {
      GameEventEmitter.getInstance().emit(
         new EnemyAnimationChangeEvent(this, this.getAnimationState().toString(), newState),
      );
   }
}

/**
 * Enemy that explodes on death and proximity
 */
export class ExplosiveEnemy extends BaseEnemy {
   constructor(world: RAPIER.World, rapier: typeof RAPIER, level: number = 1, id?: string) {
      const template = EnemyTemplates.getScaledTemplate(EnemyType.EXPLOSIVE, level);
      super(world, rapier, EnemyType.EXPLOSIVE, template, level, id);

      const aiBehavior = AIBehaviorFactory.create(template.aiBehavior);
      this.setAIBehavior(aiBehavior);

      for (const abilityType of template.abilities) {
         const ability = EnemyAbilityFactory.create(abilityType);
         this.addAbility(ability);
      }
   }

   protected getTargetingStrategy(): TargetingStrategy {
      return TargetingStrategy.CLOSEST_PLAYER;
   }

   protected performAttack(target: any): void {
      // Explosive enemies prefer to explode rather than melee attack
      this.useAbility(EnemyType.EXPLOSIVE as any, target);
   }

   protected getAvailableTargets(): any[] {
      return [];
   }

   protected onAnimationStateChanged(newState: EnemyAnimationState): void {
      GameEventEmitter.getInstance().emit(
         new EnemyAnimationChangeEvent(this, this.getAnimationState().toString(), newState),
      );
   }
}

/**
 * Enemy with dash ability to avoid bullets
 */
export class DasherEnemy extends BaseEnemy {
   private lastDashTime: number = 0;
   private dashCooldown: number = 3000; // 3 seconds

   constructor(world: RAPIER.World, rapier: typeof RAPIER, level: number = 1, id?: string) {
      const template = EnemyTemplates.getScaledTemplate(EnemyType.DASHER, level);
      super(world, rapier, EnemyType.DASHER, template, level, id);

      const aiBehavior = AIBehaviorFactory.create(template.aiBehavior);
      this.setAIBehavior(aiBehavior);

      for (const abilityType of template.abilities) {
         const ability = EnemyAbilityFactory.create(abilityType);
         this.addAbility(ability);
      }
   }

   protected getTargetingStrategy(): TargetingStrategy {
      return TargetingStrategy.CLOSEST_PLAYER;
   }

   public update(deltaTime: number, currentTime: number): void {
      super.update(deltaTime, currentTime);

      // Randomly dash to avoid attacks
      if (currentTime - this.lastDashTime > this.dashCooldown && Math.random() < 0.1) {
         // this.tryDash(currentTime);
      }
   }

   // private tryDash(currentTime: number): void {
   //    const target = this.getTarget();
   //    if (this.useAbility(EnemyType.DASHER as any, target)) {
   //       this.lastDashTime = currentTime;
   //    }
   // }

   protected performAttack(target: any): void {
      const damage = this.properties.attackDamage * (1 + (this.level - 1) * 0.15);

      GameEventEmitter.getInstance().emit(new EnemyAttackEvent(this, target, damage, 'melee'));

      if (target && typeof target.takeDamage === 'function') {
         target.takeDamage(damage, this);
      }
   }

   protected getAvailableTargets(): any[] {
      return [];
   }

   protected onAnimationStateChanged(newState: EnemyAnimationState): void {
      GameEventEmitter.getInstance().emit(
         new EnemyAnimationChangeEvent(this, this.getAnimationState().toString(), newState),
      );
   }
}

/**
 * Ranged enemy that launches rockets
 */
export class RocketLauncherEnemy extends BaseEnemy {
   constructor(world: RAPIER.World, rapier: typeof RAPIER, level: number = 1, id?: string) {
      const template = EnemyTemplates.getScaledTemplate(EnemyType.ROCKET_LAUNCHER, level);
      super(world, rapier, EnemyType.ROCKET_LAUNCHER, template, level, id);

      const aiBehavior = AIBehaviorFactory.create(template.aiBehavior);
      this.setAIBehavior(aiBehavior);

      for (const abilityType of template.abilities) {
         const ability = EnemyAbilityFactory.create(abilityType);
         this.addAbility(ability);
      }
   }

   protected getTargetingStrategy(): TargetingStrategy {
      return TargetingStrategy.PRIORITY_PLAYER;
   }

   protected performAttack(target: any): void {
      // Use rocket attack ability instead of melee
      if (!this.useAbility(EnemyType.ROCKET_LAUNCHER as any, target)) {
         // Fallback to basic ranged attack
         const damage = this.properties.attackDamage * (1 + (this.level - 1) * 0.15);

         GameEventEmitter.getInstance().emit(new EnemyAttackEvent(this, target, damage, 'ranged'));

         if (target && typeof target.takeDamage === 'function') {
            target.takeDamage(damage, this);
         }
      }
   }

   protected getAvailableTargets(): any[] {
      return [];
   }

   protected onAnimationStateChanged(newState: EnemyAnimationState): void {
      GameEventEmitter.getInstance().emit(
         new EnemyAnimationChangeEvent(this, this.getAnimationState().toString(), newState),
      );
   }
}

/**
 * Enemy that summons minions
 */
export class SummonerEnemy extends BaseEnemy {
   private minionCount: number = 0;
   private maxMinions: number = 5;

   constructor(world: RAPIER.World, rapier: typeof RAPIER, level: number = 1, id?: string) {
      const template = EnemyTemplates.getScaledTemplate(EnemyType.SUMMONER, level);
      super(world, rapier, EnemyType.SUMMONER, template, level, id);

      const aiBehavior = AIBehaviorFactory.create(template.aiBehavior);
      this.setAIBehavior(aiBehavior);

      for (const abilityType of template.abilities) {
         const ability = EnemyAbilityFactory.create(abilityType);
         this.addAbility(ability);
      }
   }

   protected getTargetingStrategy(): TargetingStrategy {
      return TargetingStrategy.PRIORITY_PLAYER;
   }

   public update(deltaTime: number, currentTime: number): void {
      super.update(deltaTime, currentTime);

      // Try to summon minions if below max
      if (this.minionCount < this.maxMinions && Math.random() < 0.02) {
         this.trySummonMinions();
      }
   }

   private trySummonMinions(): boolean {
      if (this.useAbility(EnemyAbilityType.SUMMON_MINIONS)) {
         this.minionCount += 3; // Assuming 3 minions per summon
         return true;
      }
      return false;
   }

   public onMinionDestroyed(): void {
      this.minionCount = Math.max(0, this.minionCount - 1);
   }

   protected performAttack(target: any): void {
      // Summoners prefer to summon rather than attack directly
      if (!this.trySummonMinions()) {
         const damage = this.properties.attackDamage * (1 + (this.level - 1) * 0.15);

         GameEventEmitter.getInstance().emit(new EnemyAttackEvent(this, target, damage, 'melee'));

         if (target && typeof target.takeDamage === 'function') {
            target.takeDamage(damage, this);
         }
      }
   }

   protected getAvailableTargets(): any[] {
      return [];
   }

   protected onAnimationStateChanged(newState: EnemyAnimationState): void {
      GameEventEmitter.getInstance().emit(
         new EnemyAnimationChangeEvent(this, this.getAnimationState().toString(), newState),
      );
   }
}

/**
 * Enemy that can phase through walls
 */
export class GhostEnemy extends BaseEnemy {
   constructor(world: RAPIER.World, rapier: typeof RAPIER, level: number = 1, id?: string) {
      const template = EnemyTemplates.getScaledTemplate(EnemyType.GHOST, level);
      super(world, rapier, EnemyType.GHOST, template, level, id);

      const aiBehavior = AIBehaviorFactory.create(template.aiBehavior);
      this.setAIBehavior(aiBehavior);

      for (const abilityType of template.abilities) {
         const ability = EnemyAbilityFactory.create(abilityType);
         this.addAbility(ability);
      }
   }

   protected getTargetingStrategy(): TargetingStrategy {
      return TargetingStrategy.CLOSEST_ANY;
   }

   protected performAttack(target: any): void {
      const damage = this.properties.attackDamage * (1 + (this.level - 1) * 0.15);

      GameEventEmitter.getInstance().emit(new EnemyAttackEvent(this, target, damage, 'melee'));

      if (target && typeof target.takeDamage === 'function') {
         target.takeDamage(damage, this);
      }
   }

   protected getAvailableTargets(): any[] {
      return [];
   }

   protected onAnimationStateChanged(newState: EnemyAnimationState): void {
      GameEventEmitter.getInstance().emit(
         new EnemyAnimationChangeEvent(this, this.getAnimationState().toString(), newState),
      );
   }
}

/**
 * Factory for creating concrete enemy instances
 */
export class EnemyFactory {
   public static createEnemy(
      enemyType: EnemyType,
      world: RAPIER.World,
      rapier: typeof RAPIER,
      level: number = 1,
      id?: string,
   ): BaseEnemy {
      switch (enemyType) {
         case EnemyType.DEFAULT:
            return new DefaultEnemy(world, rapier, level, id);
         case EnemyType.SPEEDY:
            return new SpeedyEnemy(world, rapier, level, id);
         case EnemyType.TANKY:
            return new TankyEnemy(world, rapier, level, id);
         case EnemyType.EXPLOSIVE:
            return new ExplosiveEnemy(world, rapier, level, id);
         case EnemyType.DASHER:
            return new DasherEnemy(world, rapier, level, id);
         case EnemyType.ROCKET_LAUNCHER:
            return new RocketLauncherEnemy(world, rapier, level, id);
         case EnemyType.SUMMONER:
            return new SummonerEnemy(world, rapier, level, id);
         case EnemyType.GHOST:
            return new GhostEnemy(world, rapier, level, id);
         case EnemyType.ACIDER:
         case EnemyType.SWARM:
         case EnemyType.SMARTASS:
         case EnemyType.DEFLECTOR:
            // These would follow the same pattern - using DefaultEnemy as fallback for now
            return new DefaultEnemy(world, rapier, level, id);
         default:
            throw new Error(`Unknown enemy type: ${enemyType}`);
      }
   }

   /**
    * Create multiple enemies of the same type
    */
   public static createEnemies(
      enemyType: EnemyType,
      count: number,
      world: RAPIER.World,
      rapier: typeof RAPIER,
      level: number = 1,
   ): BaseEnemy[] {
      const enemies: BaseEnemy[] = [];

      for (let i = 0; i < count; i++) {
         enemies.push(this.createEnemy(enemyType, world, rapier, level));
      }

      return enemies;
   }

   /**
    * Get all available enemy types
    */
   public static getAvailableTypes(): EnemyType[] {
      return Object.values(EnemyType);
   }
}
