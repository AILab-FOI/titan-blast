// shared/src/game/enemies/abilities/EnemyAbilities.ts

import { EnemyAbilityType, IEnemyAbility } from '../EnemyInterfaces';
import { Position } from '../../Position';

/**
 * No special ability - placeholder
 */
export class NoneAbility implements IEnemyAbility {
   public readonly type = EnemyAbilityType.NONE;
   public readonly cooldown = 0;

   public execute(enemy: any, target?: any): boolean {
      return false; // No effect
   }

   public canUse(enemy: any): boolean {
      return false; // Never usable
   }
}

/**
 * Dash ability - quick movement burst to avoid bullets
 */
export class DashAbility implements IEnemyAbility {
   public readonly type = EnemyAbilityType.DASH;
   public readonly cooldown = 3000; // 3 seconds

   private dashForce = 500; // Dash force multiplier
   private dashDuration = 200; // Dash lasts 200ms

   public execute(enemy: any, target?: any): boolean {
      // Generate random dash direction (slightly towards target if available)
      let dashDirection = { x: 0, y: 0 };

      if (target) {
         // Dash in a direction that's roughly towards target but with randomness
         const dx = target.position.x - enemy.position.x;
         const dy = target.position.y - enemy.position.y;
         const distance = Math.sqrt(dx * dx + dy * dy);

         if (distance > 0) {
            const baseX = dx / distance;
            const baseY = dy / distance;

            // Add random angle offset (±60 degrees)
            const randomAngle = ((Math.random() - 0.5) * Math.PI) / 1.5;
            const cos = Math.cos(randomAngle);
            const sin = Math.sin(randomAngle);

            dashDirection.x = baseX * cos - baseY * sin;
            dashDirection.y = baseX * sin + baseY * cos;
         }
      } else {
         // Random direction
         const angle = Math.random() * Math.PI * 2;
         dashDirection.x = Math.cos(angle);
         dashDirection.y = Math.sin(angle);
      }

      // Apply dash force
      enemy.applyForce({
         x: dashDirection.x * this.dashForce,
         y: dashDirection.y * this.dashForce,
      });

      return true;
   }

   public canUse(enemy: any): boolean {
      return true; // Can always dash if not on cooldown
   }
}

/**
 * Explode on death ability - damages nearby entities when killed
 */
export class ExplodeOnDeathAbility implements IEnemyAbility {
   public readonly type = EnemyAbilityType.EXPLODE_ON_DEATH;
   public readonly cooldown = 0; // No cooldown, triggered on death

   private explosionRadius = 80;
   private explosionDamage = 40;

   public execute(enemy: any, target?: any): boolean {
      // Create explosion at enemy position
      this.createExplosion(enemy.position, this.explosionRadius, this.explosionDamage);
      return true;
   }

   public canUse(enemy: any): boolean {
      return enemy.health <= 0; // Only when dead
   }

   private createExplosion(position: Position, radius: number, damage: number): void {
      // This would be implemented by the game manager to:
      // 1. Find all entities within radius
      // 2. Deal damage to them
      // 3. Create visual explosion effect
      console.log(`Explosion at ${position.x}, ${position.y} with radius ${radius} and damage ${damage}`);
   }
}

/**
 * Explode on proximity ability - explodes when close to target
 */
export class ExplodeOnProximityAbility implements IEnemyAbility {
   public readonly type = EnemyAbilityType.EXPLODE_ON_PROXIMITY;
   public readonly cooldown = 1000; // 1 second to prevent spam

   private triggerDistance = 50;
   private explosionRadius = 70;
   private explosionDamage = 35;

   public execute(enemy: any, target?: any): boolean {
      if (!target) return false;

      const distance = enemy.getDistanceToTarget(target);
      if (distance <= this.triggerDistance) {
         // Explode and damage self
         this.createExplosion(enemy.position, this.explosionRadius, this.explosionDamage);
         enemy.takeDamage(enemy.health); // Kill self
         return true;
      }

      return false;
   }

   public canUse(enemy: any): boolean {
      const target = enemy.getTarget();
      if (!target) return false;

      const distance = enemy.getDistanceToTarget(target);
      return distance <= this.triggerDistance;
   }

   public update(enemy: any, deltaTime: number): void {
      // Automatically check for proximity explosion
      if (this.canUse(enemy)) {
         this.execute(enemy, enemy.getTarget());
      }
   }

   private createExplosion(position: Position, radius: number, damage: number): void {
      console.log(`Proximity explosion at ${position.x}, ${position.y}`);
   }
}

/**
 * Summon minions ability - spawns smaller enemies
 */
export class SummonMinionsAbility implements IEnemyAbility {
   public readonly type = EnemyAbilityType.SUMMON_MINIONS;
   public readonly cooldown = 8000; // 8 seconds

   private minionCount = 3;
   private summonRadius = 60;

   public execute(enemy: any, target?: any): boolean {
      // Spawn minions around the summoner
      for (let i = 0; i < this.minionCount; i++) {
         const angle = (i / this.minionCount) * Math.PI * 2;
         const spawnX = enemy.position.x + Math.cos(angle) * this.summonRadius;
         const spawnY = enemy.position.y + Math.sin(angle) * this.summonRadius;

         this.spawnMinion({ x: spawnX, y: spawnY }, enemy.level);
      }

      return true;
   }

   public canUse(enemy: any): boolean {
      return true; // Can always summon if not on cooldown
   }

   private spawnMinion(position: Position, level: number): void {
      // This would be implemented by the game manager to spawn a new enemy
      console.log(`Spawning minion at ${position.x}, ${position.y} with level ${level}`);
   }
}

/**
 * Rocket attack ability - launches projectiles at targets
 */
export class RocketAttackAbility implements IEnemyAbility {
   public readonly type = EnemyAbilityType.ROCKET_ATTACK;
   public readonly cooldown = 4000; // 4 seconds

   private rocketSpeed = 200;
   private rocketDamage = 30;
   private explosionRadius = 40;

   public execute(enemy: any, target?: any): boolean {
      if (!target) return false;

      // Calculate direction to target
      const dx = target.position.x - enemy.position.x;
      const dy = target.position.y - enemy.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance === 0) return false;

      const direction = {
         x: dx / distance,
         y: dy / distance,
      };

      // Launch rocket
      this.launchRocket(enemy.position, direction, target.position);

      return true;
   }

   public canUse(enemy: any): boolean {
      const target = enemy.getTarget();
      if (!target) return false;

      const distance = enemy.getDistanceToTarget(target);
      return distance <= enemy.properties.attackRange && distance > 60; // Don't fire at close range
   }

   private launchRocket(startPosition: Position, direction: { x: number; y: number }, targetPosition: Position): void {
      // This would be implemented by the game manager to create a projectile
      console.log(
         `Launching rocket from ${startPosition.x}, ${startPosition.y} towards ${targetPosition.x}, ${targetPosition.y}`,
      );
   }
}

/**
 * Acid throw ability - creates damaging ground areas
 */
export class AcidThrowAbility implements IEnemyAbility {
   public readonly type = EnemyAbilityType.ACID_THROW;
   public readonly cooldown = 5000; // 5 seconds

   private acidRadius = 50;
   private acidDuration = 8000; // 8 seconds
   private acidDamagePerSecond = 15;

   public execute(enemy: any, target?: any): boolean {
      if (!target) return false;

      // Throw acid at target's current position
      this.createAcidPool(target.position, this.acidRadius, this.acidDuration, this.acidDamagePerSecond);

      return true;
   }

   public canUse(enemy: any): boolean {
      const target = enemy.getTarget();
      if (!target) return false;

      const distance = enemy.getDistanceToTarget(target);
      return distance <= enemy.properties.attackRange;
   }

   private createAcidPool(position: Position, radius: number, duration: number, damagePerSecond: number): void {
      // This would be implemented by the game manager to create a persistent damage area
      console.log(`Creating acid pool at ${position.x}, ${position.y} for ${duration}ms`);
   }
}

/**
 * Bullet deflection ability - destroys incoming bullets
 */
export class BulletDeflectionAbility implements IEnemyAbility {
   public readonly type = EnemyAbilityType.BULLET_DEFLECTION;
   public readonly cooldown = 2000; // 2 seconds

   private deflectionRadius = 60;
   private deflectionDuration = 1000; // 1 second active
   private isActive = false;
   private activeUntil = 0;

   public execute(enemy: any, target?: any): boolean {
      this.isActive = true;
      this.activeUntil = Date.now() + this.deflectionDuration;

      // Visual effect would be created here
      console.log(`${enemy.id} activated bullet deflection shield`);

      return true;
   }

   public canUse(enemy: any): boolean {
      // Activate when there are bullets nearby or when taking damage
      return true;
   }

   public update(enemy: any, deltaTime: number): void {
      if (this.isActive && Date.now() > this.activeUntil) {
         this.isActive = false;
      }

      if (this.isActive) {
         // Deflect bullets within radius
         this.deflectNearbyBullets(enemy.position, this.deflectionRadius);
      }
   }

   private deflectNearbyBullets(position: Position, radius: number): void {
      // This would be implemented by the game manager to find and destroy bullets
      console.log(`Deflecting bullets within ${radius} units of ${position.x}, ${position.y}`);
   }

   public isDeflectionActive(): boolean {
      return this.isActive;
   }
}

/**
 * Phase through ability - allows movement through solid objects
 */
export class PhaseThroughAbility implements IEnemyAbility {
   public readonly type = EnemyAbilityType.PHASE_THROUGH;
   public readonly cooldown = 0; // Passive ability

   private isPhasingEnabled = true;

   public execute(enemy: any, target?: any): boolean {
      // This is a passive ability that modifies collision behavior
      return true;
   }

   public canUse(enemy: any): boolean {
      return this.isPhasingEnabled;
   }

   public update(enemy: any, deltaTime: number): void {
      // Continuously enable phasing through walls
      if (this.isPhasingEnabled) {
         this.enablePhasing(enemy);
      }
   }

   private enablePhasing(enemy: any): void {
      // This would modify the enemy's collision settings to ignore walls
      // Implementation would be handled by the physics system
      console.log(`${enemy.id} is phasing through obstacles`);
   }

   public isPhasingActive(): boolean {
      return this.isPhasingEnabled;
   }
}

/**
 * Enemy Ability Factory
 */
export class EnemyAbilityFactory {
   private static abilities = new Map<EnemyAbilityType, () => IEnemyAbility>([
      [EnemyAbilityType.NONE, () => new NoneAbility()],
      [EnemyAbilityType.DASH, () => new DashAbility()],
      [EnemyAbilityType.EXPLODE_ON_DEATH, () => new ExplodeOnDeathAbility()],
      [EnemyAbilityType.EXPLODE_ON_PROXIMITY, () => new ExplodeOnProximityAbility()],
      [EnemyAbilityType.SUMMON_MINIONS, () => new SummonMinionsAbility()],
      [EnemyAbilityType.ROCKET_ATTACK, () => new RocketAttackAbility()],
      [EnemyAbilityType.ACID_THROW, () => new AcidThrowAbility()],
      [EnemyAbilityType.BULLET_DEFLECTION, () => new BulletDeflectionAbility()],
      [EnemyAbilityType.PHASE_THROUGH, () => new PhaseThroughAbility()],
   ]);

   public static create(abilityType: EnemyAbilityType): IEnemyAbility {
      const factory = this.abilities.get(abilityType);
      if (!factory) {
         throw new Error(`Enemy ability not implemented: ${abilityType}`);
      }
      return factory();
   }

   public static createMultiple(abilityTypes: EnemyAbilityType[]): IEnemyAbility[] {
      return abilityTypes.filter((type) => type !== EnemyAbilityType.NONE).map((type) => this.create(type));
   }

   public static getAvailableAbilities(): EnemyAbilityType[] {
      return Array.from(this.abilities.keys());
   }
}
