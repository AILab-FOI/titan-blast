// shared/src/game/shooting/DamageService.ts

import { Entity } from '../Entity';
import { Damageable, isArmorProvider, isDamageable } from '../Interfaces';
import { GunConfig } from './GunTypes';
import { ProjectileHit } from './ProjectileHit';
import { EnemyDamageEvent } from '../network/messages/client-bound/DamageEvents';

export interface DamageCalculationParams {
   baseDamage: number;
   gunPenetration: number;
   distance: number;
   gunConfig: GunConfig;
   targetArmor: number;
   currentPenetration?: number;
}

export interface DamageResult {
   finalDamage: number;
   armorReduction: number;
   distanceReduction: number;
   penetrationSuccess: boolean;
   remainingPenetration: number;
}

export class DamageService {
   private static damageEvents: EnemyDamageEvent[] = [];

   // ==================== SIMPLE DAMAGE APPLICATION ====================

   /**
    * Simple damage application (legacy method)
    */
   public static applyDamage(entity: Entity | null, damage: number): void {
      if (!entity || !this.isDamageable(entity)) return;

      const damageable = entity as unknown as Damageable;
      damageable.takeDamage(damage);
   }

   // ==================== ADVANCED DAMAGE CALCULATION ====================

   /**
    * Apply damage to an entity with full calculation including armor, distance falloff, and penetration
    */
   public static applyDamageWithCalculation(
      entity: Entity | null,
      baseDamage: number,
      gunConfig: GunConfig,
      gunPenetration: number,
      distance: number,
      position: { x: number; y: number },
      currentPenetration?: number,
   ): DamageResult | null {
      if (!entity || !this.isDamageable(entity)) {
         return null;
      }

      const damageable = entity as unknown as Damageable;

      // Get armor value using the standardized approach
      const targetArmor = this.getEntityArmor(entity);

      // Calculate damage
      const damageResult = this.calculateDamage({
         baseDamage,
         gunPenetration,
         distance,
         gunConfig,
         targetArmor,
         currentPenetration,
      });

      // Apply the calculated damage
      if (damageResult.finalDamage > 0) {
         damageable.takeDamage(damageResult.finalDamage);

         // Record damage event for client synchronization
         this.recordDamageEvent({
            targetId: entity.id,
            damage: damageResult.finalDamage,
            position,
            armorReduction: damageResult.armorReduction,
            distanceReduction: damageResult.distanceReduction,
            sourceGunType: gunConfig.gunTextureName,
            timestamp: Date.now(),
         });
      }

      return damageResult;
   }

   /**
    * Calculate final damage after all reductions
    */
   public static calculateDamage(params: DamageCalculationParams): DamageResult {
      const {
         baseDamage,
         gunPenetration,
         distance,
         gunConfig,
         targetArmor,
         currentPenetration = gunPenetration,
      } = params;

      // Calculate distance reduction
      const distanceMultiplier = this.calculateDistanceFalloff(distance, gunConfig);
      const distanceReducedDamage = baseDamage * distanceMultiplier;
      const distanceReduction = baseDamage - distanceReducedDamage;

      const armorMultiplier = this.calculateArmorReduction(currentPenetration, targetArmor);
      const finalDamage = Math.max(
         Math.floor(baseDamage * gunConfig.damageFalloff.minimumDamagePercent * 0.05), // 5% minimum
         Math.floor(distanceReducedDamage * armorMultiplier),
      );
      const armorReduction = distanceReducedDamage - finalDamage;

      // Calculate remaining penetration after hit
      const remainingPenetration = this.calculatePenetrationAfterHit(currentPenetration, targetArmor);
      const penetrationSuccess = remainingPenetration > 0;

      return {
         finalDamage,
         armorReduction,
         distanceReduction,
         penetrationSuccess,
         remainingPenetration,
      };
   }

   public static processHitsWithPenetration(
      hits: ProjectileHit[],
      baseDamage: number,
      gunConfig: GunConfig,
      initialPenetration: number,
   ): ProjectileHit[] {
      const processedHits: ProjectileHit[] = [];

      // Check if this is a shotgun (has multiple pellets)
      const isShotgun = (gunConfig.pelletCount || 1) > 1;

      if (isShotgun) {
         // SHOTGUN: Simple processing - each pellet stops at first enemy
         processedHits.push(...this.processShotgunHits(hits, baseDamage, gunConfig, initialPenetration));
      } else {
         // NON-SHOTGUN: Use penetration logic for single bullets
         processedHits.push(...this.processPenetratingBullet(hits, baseDamage, gunConfig, initialPenetration));
      }

      return processedHits;
   }

   private static processShotgunHits(
      hits: ProjectileHit[],
      baseDamage: number,
      gunConfig: GunConfig,
      initialPenetration: number,
   ): ProjectileHit[] {
      const processedHits: ProjectileHit[] = [];
      const damagePerEnemy = new Map<string, { totalDamage: number; hits: ProjectileHit[] }>();

      for (const hit of hits) {
         // Check if hit is still within range
         if (!this.isWithinRange(hit.distance, gunConfig)) {
            continue;
         }

         // If entity is null, it's a static map element (wall) - pellet stops
         if (hit.entity === null) {
            hit.penetrationLeft = 0;
            hit.damageDealt = 0;
            processedHits.push(hit);
            continue;
         }

         // Get entity armor for calculations
         const entityArmor = this.getEntityArmor(hit.entity);

         // Calculate damage for this individual pellet
         const damageResult = this.calculateDamage({
            baseDamage,
            gunPenetration: initialPenetration,
            distance: hit.distance,
            gunConfig,
            targetArmor: entityArmor,
            currentPenetration: initialPenetration,
         });

         // Update hit information
         hit.damageDealt = damageResult.finalDamage;
         hit.penetrationLeft = 0; // Shotgun pellets always stop at first enemy

         // Aggregate damage for this enemy
         const entityId = hit.entity.id;
         if (!damagePerEnemy.has(entityId)) {
            damagePerEnemy.set(entityId, { totalDamage: 0, hits: [] });
         }

         const enemyData = damagePerEnemy.get(entityId)!;
         enemyData.totalDamage += damageResult.finalDamage;
         enemyData.hits.push(hit);
      }

      // Apply aggregated damage to each enemy (one damage event per enemy)
      for (const [entityId, enemyData] of damagePerEnemy.entries()) {
         const entity = enemyData.hits[0].entity!; // We know it exists since we grouped by entity

         if (this.isDamageable(entity) && enemyData.totalDamage > 0) {
            const damageable = entity as unknown as Damageable;
            damageable.takeDamage(enemyData.totalDamage);

            this.recordDamageEvent({
               targetId: entityId,
               damage: enemyData.totalDamage,
               position: enemyData.hits[0].position,
               armorReduction: 0,
               distanceReduction: 0,
               sourceGunType: gunConfig.gunTextureName,
               timestamp: Date.now(),
            });
         }

         processedHits.push(...enemyData.hits);
      }

      return processedHits;
   }

   private static processPenetratingBullet(
      hits: ProjectileHit[],
      baseDamage: number,
      gunConfig: GunConfig,
      initialPenetration: number,
   ): ProjectileHit[] {
      const processedHits: ProjectileHit[] = [];

      // Sort hits by distance for penetration logic
      const sortedHits = [...hits].sort((a, b) => a.distance - b.distance);
      let currentPenetration = initialPenetration;

      for (const hit of sortedHits) {
         // Check if bullet is still within range
         if (!this.isWithinRange(hit.distance, gunConfig)) {
            break;
         }

         // If entity is null, it's a static map element (wall) - bullet stops
         if (hit.entity === null) {
            hit.penetrationLeft = 0;
            hit.damageDealt = 0;
            processedHits.push(hit);
            break; // Bullet stops at wall
         }

         // Get entity armor for penetration calculations
         const entityArmor = this.getEntityArmor(hit.entity);

         // Check if bullet can pass through this enemy (needs 2x penetration)
         const canPassThrough = currentPenetration >= entityArmor * 2;

         // Apply damage to this target
         const damageResult = this.applyDamageWithCalculation(
            hit.entity,
            baseDamage,
            gunConfig,
            initialPenetration,
            hit.distance,
            hit.position,
            currentPenetration,
         );

         if (damageResult) {
            // Update hit with damage information
            hit.damageDealt = damageResult.finalDamage;
            hit.penetrationLeft = damageResult.remainingPenetration;
            processedHits.push(hit);

            // Update penetration for next target
            currentPenetration = damageResult.remainingPenetration;

            // Stop if bullet can't pass through this enemy
            if (!canPassThrough) {
               break;
            }

            // Also stop if no penetration left
            if (currentPenetration <= 0) {
               break;
            }
         } else {
            // Hit a non-damageable entity, but bullet might still continue
            currentPenetration = this.calculatePenetrationAfterHit(currentPenetration, entityArmor);

            hit.penetrationLeft = currentPenetration;
            hit.damageDealt = 0;
            processedHits.push(hit);

            // Apply pass-through rule for non-damageable entities too
            if (!canPassThrough || currentPenetration <= 0) {
               break;
            }
         }
      }

      return processedHits;
   }

   /**
    * Calculate how much penetration remains after hitting an entity
    */
   public static calculatePenetrationAfterHit(currentPenetration: number, entityArmor: number): number {
      // Penetration is reduced by the entity's armor value
      return Math.max(0, currentPenetration - entityArmor);
   }

   /**
    * Calculate distance falloff multiplier
    */
   private static calculateDistanceFalloff(distance: number, gunConfig: GunConfig): number {
      const { fullDamage, falloffEnd } = gunConfig.damageRanges;
      const { minimumDamagePercent } = gunConfig.damageFalloff;

      if (distance <= fullDamage) {
         return 1.0; // Full damage
      }

      if (distance >= falloffEnd) {
         return minimumDamagePercent; // Minimum damage
      }

      // Linear interpolation between full damage and minimum damage
      const falloffDistance = falloffEnd - fullDamage;
      const distanceIntoFalloff = distance - fullDamage;
      const falloffProgress = distanceIntoFalloff / falloffDistance;

      return 1.0 - falloffProgress * (1.0 - minimumDamagePercent);
   }

   /**
    * Calculate armor reduction multiplier based on penetration vs armor
    */
   private static calculateArmorReduction(penetration: number, armor: number): number {
      if (armor === 0) return 1.0; // No armor, full damage
      if (penetration <= 0) return 0.1; // No penetration, 10% damage

      // Avoid divide-by-zero or severe damage reduction
      // Instead of percentage-based, use a more aggressive reduction
      const effectiveness = penetration / armor;
      const damageMultiplier = 0.1 + 0.9 * effectiveness; // 10% minimum, scaling to 100%

      return damageMultiplier;
   }

   // ==================== UTILITY METHODS ====================

   /**
    * Check if distance is within gun's effective range
    */
   public static isWithinRange(distance: number, gunConfig: GunConfig): boolean {
      return distance <= gunConfig.damageRanges.maxRange;
   }

   /**
    * Safely get armor value from an entity using the standardized approach
    */
   public static getEntityArmor(entity: Entity | null): number {
      if (!entity) return 0;

      // Check if entity implements ArmorProvider interface
      if (isArmorProvider(entity)) {
         return entity.getArmor();
      }

      // Fallback: check if entity has direct armor property (for backward compatibility)
      if ('armor' in entity && typeof (entity as any).armor === 'number') {
         return (entity as any).armor;
      }

      return 0;
   }

   /**
    * Check if entity can take damage
    */
   public static isDamageable(entity: Entity | null): boolean {
      if (!entity) return false;
      return isDamageable(entity);
   }

   // ==================== NETWORK SYNCHRONIZATION ====================

   /**
    * Get recent damage events for network synchronization
    */
   public static getRecentDamageEvents(): EnemyDamageEvent[] {
      const events = [...this.damageEvents];
      this.damageEvents = []; // Clear events after retrieving
      return events;
   }

   /**
    * Record a damage event for client synchronization
    */
   private static recordDamageEvent(event: EnemyDamageEvent): void {
      this.damageEvents.push(event);
   }
}
