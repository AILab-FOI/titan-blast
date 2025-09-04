// shared/src/game/events/events/EnemyEvents.ts

import { BaseEnemy } from '../../enemies/BaseEnemy';
import { EnemyNetworkData, EnemySpawnConfig } from '../../enemies/EnemyInterfaces';
import { Position } from '../../Position';
import { GameEvent } from './GameEvent';

/**
 * Event fired when an enemy is spawned
 */
export class EnemySpawnEvent extends GameEvent {
   public readonly enemy: BaseEnemy;
   public readonly spawnConfig: EnemySpawnConfig;

   constructor(enemy: BaseEnemy, spawnConfig: EnemySpawnConfig) {
      super(EnemySpawnEvent.getType());
      this.enemy = enemy;
      this.spawnConfig = spawnConfig;
   }

   public static getType(): string {
      return 'enemy_spawn';
   }
}

/**
 * Event fired when an enemy takes damage
 */
export class EnemyDamageEvent extends GameEvent {
   public readonly enemy: BaseEnemy;
   public readonly damage: number;
   public readonly source: any;
   public readonly remainingHealth: number;

   constructor(enemy: BaseEnemy, damage: number, source?: any) {
      super(EnemyDamageEvent.getType());
      this.enemy = enemy;
      this.damage = damage;
      this.source = source;
      this.remainingHealth = enemy.health;
   }

   public static getType(): string {
      return 'enemy_damage';
   }
}

/**
 * Event fired when an enemy dies
 */
export class EnemyDeathEvent extends GameEvent {
   public readonly enemy: BaseEnemy;
   public readonly scoreValue: number;
   public readonly killer?: any;
   public readonly deathPosition: Position;

   constructor(enemy: BaseEnemy, scoreValue: number, deathPosition: Position, killer?: any) {
      super(EnemyDeathEvent.getType());
      this.enemy = enemy;
      this.scoreValue = scoreValue;
      this.killer = killer;
      this.deathPosition = deathPosition;
   }

   public static getType(): string {
      return 'enemy_death';
   }
}

/**
 * Event fired when an enemy uses an ability
 */
export class EnemyAbilityEvent extends GameEvent {
   public readonly enemy: BaseEnemy;
   public readonly abilityType: string;
   public readonly target?: any;
   public readonly success: boolean;

   constructor(enemy: BaseEnemy, abilityType: string, success: boolean, target?: any) {
      super(EnemyAbilityEvent.getType());
      this.enemy = enemy;
      this.abilityType = abilityType;
      this.target = target;
      this.success = success;
   }

   public static getType(): string {
      return 'enemy_ability';
   }
}

/**
 * Event fired when an enemy's AI behavior changes
 */
export class EnemyAIStateChangeEvent extends GameEvent {
   public readonly enemy: BaseEnemy;
   public readonly previousState: string;
   public readonly newState: string;
   public readonly reason?: string;

   constructor(enemy: BaseEnemy, previousState: string, newState: string, reason?: string) {
      super(EnemyAIStateChangeEvent.getType());
      this.enemy = enemy;
      this.previousState = previousState;
      this.newState = newState;
      this.reason = reason;
   }

   public static getType(): string {
      return 'enemy_ai_state_change';
   }
}

/**
 * Event fired when an enemy acquires a new target
 */
export class EnemyTargetAcquiredEvent extends GameEvent {
   public readonly enemy: BaseEnemy;
   public readonly target: any;
   public readonly previousTarget?: any;

   constructor(enemy: BaseEnemy, target: any, previousTarget?: any) {
      super(EnemyTargetAcquiredEvent.getType());
      this.enemy = enemy;
      this.target = target;
      this.previousTarget = previousTarget;
   }

   public static getType(): string {
      return 'enemy_target_acquired';
   }
}

/**
 * Event fired when an enemy loses its target
 */
export class EnemyTargetLostEvent extends GameEvent {
   public readonly enemy: BaseEnemy;
   public readonly lostTarget: any;
   public readonly reason: 'out_of_range' | 'target_destroyed' | 'line_of_sight_lost' | 'other';

   constructor(
      enemy: BaseEnemy,
      lostTarget: any,
      reason: 'out_of_range' | 'target_destroyed' | 'line_of_sight_lost' | 'other' = 'other',
   ) {
      super(EnemyTargetLostEvent.getType());
      this.enemy = enemy;
      this.lostTarget = lostTarget;
      this.reason = reason;
   }

   public static getType(): string {
      return 'enemy_target_lost';
   }
}

/**
 * Event fired when an enemy attacks
 */
export class EnemyAttackEvent extends GameEvent {
   public readonly enemy: BaseEnemy;
   public readonly target: any;
   public readonly damage: number;
   public readonly attackType: 'melee' | 'ranged' | 'ability';

   constructor(enemy: BaseEnemy, target: any, damage: number, attackType: 'melee' | 'ranged' | 'ability' = 'melee') {
      super(EnemyAttackEvent.getType());
      this.enemy = enemy;
      this.target = target;
      this.damage = damage;
      this.attackType = attackType;
   }

   public static getType(): string {
      return 'enemy_attack';
   }
}

/**
 * Event fired when enemies need to be spawned (for spawn system)
 */
export class EnemySpawnRequestEvent extends GameEvent {
   public readonly spawnConfigs: EnemySpawnConfig[];
   public readonly spawnReason: 'wave' | 'continuous' | 'triggered' | 'manual';

   constructor(
      spawnConfigs: EnemySpawnConfig[],
      spawnReason: 'wave' | 'continuous' | 'triggered' | 'manual' = 'manual',
   ) {
      super(EnemySpawnRequestEvent.getType());
      this.spawnConfigs = spawnConfigs;
      this.spawnReason = spawnReason;
   }

   public static getType(): string {
      return 'enemy_spawn_request';
   }
}

/**
 * Event fired when an enemy's animation state changes
 */
export class EnemyAnimationChangeEvent extends GameEvent {
   public readonly enemy: BaseEnemy;
   public readonly previousAnimation: string;
   public readonly newAnimation: string;

   constructor(enemy: BaseEnemy, previousAnimation: string, newAnimation: string) {
      super(EnemyAnimationChangeEvent.getType());
      this.enemy = enemy;
      this.previousAnimation = previousAnimation;
      this.newAnimation = newAnimation;
   }

   public static getType(): string {
      return 'enemy_animation_change';
   }
}

/**
 * Event fired when enemy data needs to be synchronized over network
 */
export class EnemyNetworkUpdateEvent extends GameEvent {
   public readonly enemyData: EnemyNetworkData[];
   public readonly updateType: 'full' | 'delta' | 'essential';

   constructor(enemyData: EnemyNetworkData[], updateType: 'full' | 'delta' | 'essential' = 'delta') {
      super(EnemyNetworkUpdateEvent.getType());
      this.enemyData = enemyData;
      this.updateType = updateType;
   }

   public static getType(): string {
      return 'enemy_network_update';
   }
}

/**
 * Event fired when an explosion occurs (from enemy abilities)
 */
export class ExplosionEvent extends GameEvent {
   public readonly position: Position;
   public readonly radius: number;
   public readonly damage: number;
   public readonly source: BaseEnemy;
   public readonly affectedEntities: any[];

   constructor(position: Position, radius: number, damage: number, source: BaseEnemy, affectedEntities: any[] = []) {
      super(ExplosionEvent.getType());
      this.position = position;
      this.radius = radius;
      this.damage = damage;
      this.source = source;
      this.affectedEntities = affectedEntities;
   }

   public static getType(): string {
      return 'explosion';
   }
}

/**
 * Event fired when a projectile is created (rockets, acid, etc.)
 */
export class ProjectileCreatedEvent extends GameEvent {
   public readonly projectileId: string;
   public readonly startPosition: Position;
   public readonly targetPosition: Position;
   public readonly projectileType: 'rocket' | 'acid' | 'bullet';
   public readonly damage: number;
   public readonly speed: number;
   public readonly source: BaseEnemy;

   constructor(
      projectileId: string,
      startPosition: Position,
      targetPosition: Position,
      projectileType: 'rocket' | 'acid' | 'bullet',
      damage: number,
      speed: number,
      source: BaseEnemy,
   ) {
      super(ProjectileCreatedEvent.getType());
      this.projectileId = projectileId;
      this.startPosition = startPosition;
      this.targetPosition = targetPosition;
      this.projectileType = projectileType;
      this.damage = damage;
      this.speed = speed;
      this.source = source;
   }

   public static getType(): string {
      return 'projectile_created';
   }
}

/**
 * Event fired when a damage area is created (acid pools, fire, etc.)
 */
export class DamageAreaCreatedEvent extends GameEvent {
   public readonly areaId: string;
   public readonly position: Position;
   public readonly radius: number;
   public readonly damagePerSecond: number;
   public readonly duration: number;
   public readonly areaType: 'acid' | 'fire' | 'poison' | 'electric';
   public readonly source: BaseEnemy;

   constructor(
      areaId: string,
      position: Position,
      radius: number,
      damagePerSecond: number,
      duration: number,
      areaType: 'acid' | 'fire' | 'poison' | 'electric',
      source: BaseEnemy,
   ) {
      super(DamageAreaCreatedEvent.getType());
      this.areaId = areaId;
      this.position = position;
      this.radius = radius;
      this.damagePerSecond = damagePerSecond;
      this.duration = duration;
      this.areaType = areaType;
      this.source = source;
   }

   public static getType(): string {
      return 'damage_area_created';
   }
}
