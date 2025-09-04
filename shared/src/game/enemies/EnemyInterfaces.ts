// shared/src/game/enemies/EnemyInterfaces.ts

import { Position } from '../Position';
import { AnimationState } from '../PlayerTypes';
import { ITargetable } from './EnemyTargetSystem';
import { SteeringController } from './steering/SteeringController';

/**
 * Enumeration of all enemy types in the game
 */
export enum EnemyType {
   DEFAULT = 'default',
   SPEEDY = 'speedy',
   TANKY = 'tanky',
   EXPLOSIVE = 'explosive',
   DASHER = 'dasher',
   ROCKET_LAUNCHER = 'rocket_launcher',
   SUMMONER = 'summoner',
   GHOST = 'ghost',
   ACIDER = 'acider',
   SWARM = 'swarm',
   SMARTASS = 'smartass',
   DEFLECTOR = 'deflector',
}

/**
 * Enumeration of AI behavior types that can be reused across enemy types
 */
export enum AIBehaviorType {
   BASIC_CHASE = 'basic_chase', // Move directly toward nearest player
   STRATEGIC = 'strategic', // Target important structures, move unpredictably
   PATROL = 'patrol', // Move in predefined patterns
   SWARM = 'swarm', // Coordinate with nearby enemies
   DEFENSIVE = 'defensive', // Stay back and attack from range
   GHOST_PHASE = 'ghost_phase', // Can move through walls
}

/**
 * Enumeration of special abilities that enemies can have
 */
export enum EnemyAbilityType {
   NONE = 'none',
   DASH = 'dash', // Quick movement burst to avoid bullets
   EXPLODE_ON_DEATH = 'explode_on_death', // Damages nearby entities when killed
   EXPLODE_ON_PROXIMITY = 'explode_on_proximity', // Explodes when close to target
   SUMMON_MINIONS = 'summon_minions', // Spawns smaller enemies
   ROCKET_ATTACK = 'rocket_attack', // Launches projectiles
   ACID_THROW = 'acid_throw', // Creates damaging ground areas
   BULLET_DEFLECTION = 'bullet_deflection', // Destroys incoming bullets
   PHASE_THROUGH = 'phase_through', // Move through solid objects
}

/**
 * Animation states specific to enemies (extends base AnimationState)
 */
export enum EnemyAnimationState {
   IDLE = AnimationState.IDLE,
   MOVE = AnimationState.MOVE,
   ATTACK = 'attacking',
   ABILITY = 'ability', // For special ability animations
}

/**
 * Core properties that define an enemy's characteristics
 */
export interface EnemyProperties {
   readonly type: EnemyType;
   readonly name: string;
   readonly spritePath: string; // Path to the sprite sheet JSON file

   // Combat stats
   readonly maxHealth: number;
   readonly attackDamage: number;
   readonly attackRange: number;
   readonly attackCooldown: number; // milliseconds between attacks
   readonly armor: number; // damage reduction

   // Movement and detection
   readonly movementSpeed: number;
   readonly detectionRange: number;
   readonly aggroRange: number;

   // Physics properties
   readonly physics: EnemyPhysicsProperties;

   // Behavior and abilities
   readonly aiBehavior: AIBehaviorType;
   readonly abilities: EnemyAbilityType[];

   // Gameplay mechanics
   readonly scoreValue: number; // Points awarded for killing
   readonly level: number;

   // Animation configuration
   readonly animationFrameRates: Record<EnemyAnimationState, number>;

   // Status effect resistances (0 = no resistance, 1 = immunity)
   readonly statusResistances: {
      slow: number;
      stun: number;
      poison: number;
      knockback: number;
   };

   // Target priorities (higher = more preferred)
   readonly targetPriorities: {
      player: number;
      structures: number;
   };
}

/**
 * Physics configuration for enemies
 */
export interface EnemyPhysicsProperties {
   readonly mass: number;
   readonly friction: number;
   readonly restitution: number;
   readonly linearDamping: number;
   readonly angularDamping: number;
   readonly dimensions: {
      width: number;
      height: number;
   };
   readonly collisionGroup: number;
}

/**
 * Data structure for enemy state synchronization between server and client
 */
export interface EnemyNetworkData {
   id: string;
   position: Position;
   rotation: number;
   animationState: EnemyAnimationState;

   // AI state (optional, for debugging)
   targetId?: string;
   lastAttackTime?: number;
}

/**
 * Interface for AI behavior implementations
 */
export interface IAIBehavior {
   readonly type: AIBehaviorType;

   /**
    * Update AI with a single target (new approach)
    */
   updateWithTarget(enemy: any, deltaTime: number, target: ITargetable): void;

   /**
    * Legacy update method for backward compatibility
    * @deprecated Use updateWithTarget instead
    */
   update?(enemy: any, deltaTime: number, targets: ITargetable[]): void;

   onDamaged?(enemy: any, damage: number, source: any): void;

   onTargetLost?(enemy: any): void;

   createSteeringConfig?(): SteeringController;
}

/**
 * Interface for enemy abilities
 */
export interface IEnemyAbility {
   readonly type: EnemyAbilityType;
   readonly cooldown: number; // milliseconds

   /**
    * Execute the ability
    * @param enemy The enemy using the ability
    * @param target The target (if applicable)
    * @returns true if ability was successfully executed
    */
   execute(enemy: any, target?: any): boolean;

   /**
    * Check if the ability can be used
    * @param enemy The enemy that wants to use the ability
    * @returns true if ability is ready to use
    */
   canUse(enemy: any): boolean;

   /**
    * Called every update to handle ongoing ability effects
    */
   update?(enemy: any, deltaTime: number): void;
}

/**
 * Configuration for enemy spawning
 */
export interface EnemySpawnConfig {
   enemyType: EnemyType;
   position: Position;
   level?: number;
   customProperties?: Partial<EnemyProperties>;
}
