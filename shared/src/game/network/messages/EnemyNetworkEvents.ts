// shared/src/game/network/EnemyNetworkEvents.ts

import { EnemyNetworkData, EnemyType } from '../../enemies/EnemyInterfaces';
import { Position } from '../../Position';

/**
 * Server -> Client: Enemy spawn notification
 */
export interface EnemySpawnData {
   enemies: Array<{
      id: string;
      type: EnemyType;
      level: number;
      position: Position;
      rotation: number;
      properties?: any;
   }>;
}

/**
 * Server -> Client: Enemy state updates
 */
export interface EnemyUpdateData {
   enemies: EnemyNetworkData[];
   tick: number;
   timestamp: number;
}

/**
 * Enemy delta update data (only changed properties)
 */
export interface EnemyDeltaUpdateData {
   enemies: Partial<EnemyNetworkData>[]; // Partial data for delta updates
   tick: number;
   timestamp: number;
}

/**
 * Server -> Client: Enemy despawn notification
 */
export interface EnemyDespawnData {
   enemyIds: string[];
   reason: 'death' | 'cleanup' | 'out_of_bounds';
}

/**
 * Server -> Client: Enemy ability activation
 */
export interface EnemyAbilityData {
   enemyId: string;
   abilityType: string;
   position: Position;
   targetPosition?: Position;
   targetId?: string;
   effectData?: any; // Additional data for visual effects
}

/**
 * Server -> Client: Enemy death event with effects
 */
export interface EnemyDeathData {
   enemyId: string;
   deathPosition: Position;
   killerPlayerId?: string;
   scoreAwarded: number;
   deathEffects?: {
      explosion?: {
         radius: number;
         damage: number;
      };
      lootDrop?: {
         items: string[];
         position: Position;
      };
   };
}

/**
 * Server -> Client: Explosion effect from enemy abilities
 */
export interface ExplosionEffectData {
   position: Position;
   radius: number;
   damage: number;
   explosionType: 'enemy_death' | 'rocket' | 'proximity' | 'other';
   sourceEnemyId: string;
   affectedEntityIds: string[];
}

/**
 * Server -> Client: Projectile creation (rockets, acid, etc.)
 */
export interface ProjectileSpawnData {
   projectileId: string;
   startPosition: Position;
   targetPosition: Position;
   velocity: { x: number; y: number };
   projectileType: 'rocket' | 'acid' | 'energy_ball';
   damage: number;
   sourceEnemyId: string;
   visualEffects?: {
      trailColor?: string;
      glowEffect?: boolean;
      particleCount?: number;
   };
}

/**
 * Server -> Client: Damage area creation (acid pools, fire, etc.)
 */
export interface DamageAreaSpawnData {
   areaId: string;
   position: Position;
   radius: number;
   damagePerSecond: number;
   duration: number;
   areaType: 'acid' | 'fire' | 'poison' | 'electric';
   sourceEnemyId: string;
   visualEffects?: {
      color?: string;
      intensity?: number;
      bubbleEffect?: boolean;
   };
}

/**
 * Client -> Server: Enemy target request (for debugging/admin)
 */
export interface EnemyTargetRequest {
   enemyId: string;
   targetId?: string;
   command: 'set_target' | 'clear_target' | 'force_ability';
   abilityType?: string;
}

/**
 * Server -> Client: Enemy AI state for debugging
 */
export interface EnemyAIDebugData {
   enemyId: string;
   aiState: string;
   currentTarget?: string;
   pathfinding?: {
      waypoints: Position[];
      currentWaypoint: number;
   };
   abilityStates: Array<{
      type: string;
      cooldownRemaining: number;
      canUse: boolean;
   }>;
}

/**
 * Network event builders for easy creation
 */
export class EnemyNetworkEventBuilder {
   /**
    * Build enemy spawn event data
    */
   public static buildSpawnData(
      enemies: Array<{
         id: string;
         type: EnemyType;
         level: number;
         position: Position;
         rotation: number;
         properties?: any;
      }>,
   ): EnemySpawnData {
      return { enemies };
   }

   /**
    * Build enemy update event data
    */
   public static buildUpdateData(enemies: EnemyNetworkData[], tick: number, timestamp: number): EnemyUpdateData {
      return {
         enemies,
         tick,
         timestamp,
      };
   }

   /**
    * Build enemy delta update event data (only changed properties)
    */
   public static buildDeltaUpdateData(
      deltaEnemies: Partial<EnemyNetworkData>[],
      tick: number,
      timestamp: number,
   ): EnemyDeltaUpdateData {
      return {
         enemies: deltaEnemies,
         tick,
         timestamp,
      };
   }

   /**
    * Build enemy despawn event data
    */
   public static buildDespawnData(
      enemyIds: string[],
      reason: 'death' | 'cleanup' | 'out_of_bounds' = 'death',
   ): EnemyDespawnData {
      return {
         enemyIds,
         reason,
      };
   }

   /**
    * Build enemy ability event data
    */
   public static buildAbilityData(
      enemyId: string,
      abilityType: string,
      position: Position,
      targetPosition?: Position,
      targetId?: string,
      effectData?: any,
   ): EnemyAbilityData {
      return {
         enemyId,
         abilityType,
         position,
         targetPosition,
         targetId,
         effectData,
      };
   }

   /**
    * Build enemy death event data
    */
   public static buildDeathData(
      enemyId: string,
      deathPosition: Position,
      scoreAwarded: number,
      killerPlayerId?: string,
      deathEffects?: EnemyDeathData['deathEffects'],
   ): EnemyDeathData {
      return {
         enemyId,
         deathPosition,
         killerPlayerId,
         scoreAwarded,
         deathEffects,
      };
   }

   /**
    * Build explosion effect data
    */
   public static buildExplosionData(
      position: Position,
      radius: number,
      damage: number,
      explosionType: ExplosionEffectData['explosionType'],
      sourceEnemyId: string,
      affectedEntityIds: string[] = [],
   ): ExplosionEffectData {
      return {
         position,
         radius,
         damage,
         explosionType,
         sourceEnemyId,
         affectedEntityIds,
      };
   }

   /**
    * Build projectile spawn data
    */
   public static buildProjectileData(
      projectileId: string,
      startPosition: Position,
      targetPosition: Position,
      velocity: { x: number; y: number },
      projectileType: ProjectileSpawnData['projectileType'],
      damage: number,
      sourceEnemyId: string,
      visualEffects?: ProjectileSpawnData['visualEffects'],
   ): ProjectileSpawnData {
      return {
         projectileId,
         startPosition,
         targetPosition,
         velocity,
         projectileType,
         damage,
         sourceEnemyId,
         visualEffects,
      };
   }

   /**
    * Build damage area spawn data
    */
   public static buildDamageAreaData(
      areaId: string,
      position: Position,
      radius: number,
      damagePerSecond: number,
      duration: number,
      areaType: DamageAreaSpawnData['areaType'],
      sourceEnemyId: string,
      visualEffects?: DamageAreaSpawnData['visualEffects'],
   ): DamageAreaSpawnData {
      return {
         areaId,
         position,
         radius,
         damagePerSecond,
         duration,
         areaType,
         sourceEnemyId,
         visualEffects,
      };
   }
}
