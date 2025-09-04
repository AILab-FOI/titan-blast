// shared/src/game/enemies/EnemyTemplates.ts

import { AIBehaviorType, EnemyAbilityType, EnemyAnimationState, EnemyProperties, EnemyType } from './EnemyInterfaces';
import { CollisionGroups } from '../CollisionSettings';

/**
 * Registry of all enemy type templates
 * Each template defines the base properties for an enemy type
 */
export class EnemyTemplates {
   private static readonly templates: Record<EnemyType, EnemyProperties> = {
      [EnemyType.DEFAULT]: {
         type: EnemyType.DEFAULT,
         name: 'Basic Alien',
         spritePath: './src/game/assets/enemies/enemy-walker.json',

         // Combat stats
         maxHealth: 75,
         attackDamage: 15,
         attackRange: 40,
         attackCooldown: 1500,
         armor: 5,

         // Movement and detection
         movementSpeed: 4,
         detectionRange: 3000,
         aggroRange: 0,

         // Physics properties
         physics: {
            mass: 200,
            friction: 0.01,
            restitution: 0.1,
            linearDamping: 8,
            angularDamping: 10,
            dimensions: { width: 120, height: 110 },
            collisionGroup: CollisionGroups.Enemy,
         },

         // Behavior
         aiBehavior: AIBehaviorType.BASIC_CHASE,
         abilities: [EnemyAbilityType.NONE],

         // Gameplay
         scoreValue: 10,
         level: 1,

         // Animation
         animationFrameRates: {
            [EnemyAnimationState.IDLE]: 8,
            [EnemyAnimationState.MOVE]: 6,
            [EnemyAnimationState.ATTACK]: 8,
            [EnemyAnimationState.ABILITY]: 4,
         },

         // Resistances
         statusResistances: {
            slow: 0,
            stun: 0,
            poison: 0,
            knockback: 0,
         },

         // Target priorities
         targetPriorities: {
            player: 10,
            structures: 3,
         },
      },

      [EnemyType.SPEEDY]: {
         type: EnemyType.SPEEDY,
         name: 'Speed Demon',
         spritePath: './src/game/assets/enemies/enemy-buff.json',

         maxHealth: 80,
         attackDamage: 12,
         attackRange: 35,
         attackCooldown: 1000,
         armor: 5,

         movementSpeed: 4,
         detectionRange: 2000,
         aggroRange: 0,

         physics: {
            mass: 50,
            friction: 0,
            restitution: 0.2,
            linearDamping: 6,
            angularDamping: 8,
            dimensions: { width: 50, height: 70 },
            collisionGroup: CollisionGroups.Enemy,
         },

         aiBehavior: AIBehaviorType.BASIC_CHASE,
         abilities: [EnemyAbilityType.NONE],

         scoreValue: 15,
         level: 1,

         animationFrameRates: {
            [EnemyAnimationState.IDLE]: 15,
            [EnemyAnimationState.MOVE]: 15,
            [EnemyAnimationState.ATTACK]: 1,
            [EnemyAnimationState.ABILITY]: 1,
         },

         statusResistances: {
            slow: 0.3, // 30% resistance to slow effects
            stun: 0,
            poison: 0,
            knockback: 0.2,
         },

         targetPriorities: {
            player: 12,
            structures: 2,
         },
      },

      [EnemyType.TANKY]: {
         type: EnemyType.TANKY,
         name: 'Insect',
         spritePath: './src/game/assets/enemies/enemy-insect.json',

         maxHealth: 150,
         attackDamage: 25,
         attackRange: 45,
         attackCooldown: 2000,
         armor: 5,

         movementSpeed: 6,
         detectionRange: 2000,
         aggroRange: 0,

         physics: {
            mass: 120,
            friction: 0.7,
            restitution: 0.05,
            linearDamping: 12,
            angularDamping: 15,
            dimensions: { width: 100, height: 90 },
            collisionGroup: CollisionGroups.Enemy,
         },

         aiBehavior: AIBehaviorType.BASIC_CHASE,
         abilities: [EnemyAbilityType.NONE],

         scoreValue: 25,
         level: 1,

         animationFrameRates: {
            [EnemyAnimationState.IDLE]: 10,
            [EnemyAnimationState.MOVE]: 7,
            [EnemyAnimationState.ATTACK]: 6,
            [EnemyAnimationState.ABILITY]: 3,
         },

         statusResistances: {
            slow: 0.5,
            stun: 0.3,
            poison: 0.2,
            knockback: 0.8, // Very resistant to knockback
         },

         targetPriorities: {
            player: 8,
            structures: 6, // More interested in structures
         },
      },

      [EnemyType.EXPLOSIVE]: {
         type: EnemyType.EXPLOSIVE,
         name: 'Boom Crawler',
         spritePath: './src/game/assets/enemies/enemy-buff.json',

         maxHealth: 40,
         attackDamage: 50, // High damage explosion
         attackRange: 60, // Explosion radius
         attackCooldown: 500,
         armor: 0,

         movementSpeed: 90,
         detectionRange: 300,
         aggroRange: 250,

         physics: {
            mass: 60,
            friction: 0.4,
            restitution: 0.1,
            linearDamping: 7,
            angularDamping: 9,
            dimensions: { width: 30, height: 30 },
            collisionGroup: CollisionGroups.Enemy,
         },

         aiBehavior: AIBehaviorType.BASIC_CHASE,
         abilities: [EnemyAbilityType.EXPLODE_ON_DEATH, EnemyAbilityType.EXPLODE_ON_PROXIMITY],

         scoreValue: 20,
         level: 1,

         animationFrameRates: {
            [EnemyAnimationState.IDLE]: 3,
            [EnemyAnimationState.MOVE]: 8,
            [EnemyAnimationState.ATTACK]: 12,
            [EnemyAnimationState.ABILITY]: 8,
         },

         statusResistances: {
            slow: 0,
            stun: 0,
            poison: 0.8, // Resistant to poison
            knockback: 0.1,
         },

         targetPriorities: {
            player: 15, // Really wants to get close to players
            structures: 8,
         },
      },

      [EnemyType.DASHER]: {
         type: EnemyType.DASHER,
         name: 'Dash Striker',
         spritePath: './src/game/assets/enemies/enemy-buff.json',

         maxHealth: 35,
         attackDamage: 18,
         attackRange: 40,
         attackCooldown: 1200,
         armor: 0,

         movementSpeed: 100,
         detectionRange: 320,
         aggroRange: 280,

         physics: {
            mass: 55,
            friction: 0.2,
            restitution: 0.3,
            linearDamping: 5,
            angularDamping: 7,
            dimensions: { width: 30, height: 30 },
            collisionGroup: CollisionGroups.Enemy,
         },

         aiBehavior: AIBehaviorType.BASIC_CHASE,
         abilities: [EnemyAbilityType.DASH],

         scoreValue: 18,
         level: 1,

         animationFrameRates: {
            [EnemyAnimationState.IDLE]: 3,
            [EnemyAnimationState.MOVE]: 10,
            [EnemyAnimationState.ATTACK]: 8,
            [EnemyAnimationState.ABILITY]: 15, // Fast dash animation
         },

         statusResistances: {
            slow: 0.4,
            stun: 0.1,
            poison: 0,
            knockback: 0.3,
         },

         targetPriorities: {
            player: 11,
            structures: 4,
         },
      },

      [EnemyType.ROCKET_LAUNCHER]: {
         type: EnemyType.ROCKET_LAUNCHER,
         name: 'Rocket Trooper',
         spritePath: './src/game/assets/enemies/enemy-buff.json',

         maxHealth: 80,
         attackDamage: 35,
         attackRange: 200, // Long range
         attackCooldown: 3000,
         armor: 5,

         movementSpeed: 60,
         detectionRange: 400,
         aggroRange: 350,

         physics: {
            mass: 85,
            friction: 0.6,
            restitution: 0.1,
            linearDamping: 10,
            angularDamping: 12,
            dimensions: { width: 36, height: 36 },
            collisionGroup: CollisionGroups.Enemy,
         },

         aiBehavior: AIBehaviorType.DEFENSIVE,
         abilities: [EnemyAbilityType.ROCKET_ATTACK],

         scoreValue: 30,
         level: 1,

         animationFrameRates: {
            [EnemyAnimationState.IDLE]: 2,
            [EnemyAnimationState.MOVE]: 5,
            [EnemyAnimationState.ATTACK]: 4,
            [EnemyAnimationState.ABILITY]: 6,
         },

         statusResistances: {
            slow: 0.2,
            stun: 0.1,
            poison: 0,
            knockback: 0.4,
         },

         targetPriorities: {
            player: 9,
            structures: 7,
         },
      },

      [EnemyType.SUMMONER]: {
         type: EnemyType.SUMMONER,
         name: 'Hive Mind',
         spritePath: './src/game/assets/enemies/enemy-buff.json',

         maxHealth: 120,
         attackDamage: 10, // Low direct damage
         attackRange: 50,
         attackCooldown: 2500,
         armor: 10,

         movementSpeed: 40,
         detectionRange: 350,
         aggroRange: 300,

         physics: {
            mass: 100,
            friction: 0.8,
            restitution: 0.05,
            linearDamping: 15,
            angularDamping: 20,
            dimensions: { width: 42, height: 42 },
            collisionGroup: CollisionGroups.Enemy,
         },

         aiBehavior: AIBehaviorType.DEFENSIVE,
         abilities: [EnemyAbilityType.SUMMON_MINIONS],

         scoreValue: 40,
         level: 1,

         animationFrameRates: {
            [EnemyAnimationState.IDLE]: 1,
            [EnemyAnimationState.MOVE]: 3,
            [EnemyAnimationState.ATTACK]: 5,
            [EnemyAnimationState.ABILITY]: 2, // Slow summoning animation
         },

         statusResistances: {
            slow: 0.6,
            stun: 0.4,
            poison: 0.3,
            knockback: 0.7,
         },

         targetPriorities: {
            player: 6,
            structures: 9, // Prioritizes structures
         },
      },

      [EnemyType.GHOST]: {
         type: EnemyType.GHOST,
         name: 'Phase Walker',
         spritePath: './src/game/assets/enemies/enemy-buff.json',

         maxHealth: 45,
         attackDamage: 20,
         attackRange: 35,
         attackCooldown: 1300,
         armor: 0,

         movementSpeed: 95,
         detectionRange: 320,
         aggroRange: 280,

         physics: {
            mass: 40, // Light for phasing
            friction: 0.1,
            restitution: 0.5,
            linearDamping: 3,
            angularDamping: 5,
            dimensions: { width: 32, height: 32 },
            collisionGroup: CollisionGroups.Enemy,
         },

         aiBehavior: AIBehaviorType.GHOST_PHASE,
         abilities: [EnemyAbilityType.PHASE_THROUGH],

         scoreValue: 25,
         level: 1,

         animationFrameRates: {
            [EnemyAnimationState.IDLE]: 3,
            [EnemyAnimationState.MOVE]: 8,
            [EnemyAnimationState.ATTACK]: 7,
            [EnemyAnimationState.ABILITY]: 6,
         },

         statusResistances: {
            slow: 0.5,
            stun: 0.8, // Hard to stun a ghost
            poison: 1.0, // Immune to poison
            knockback: 0.9, // Almost immune to knockback
         },

         targetPriorities: {
            player: 12,
            structures: 1, // Ignores most structures due to phasing
         },
      },

      [EnemyType.ACIDER]: {
         type: EnemyType.ACIDER,
         name: 'Acid Spitter',
         spritePath: './src/game/assets/enemies/enemy-buff.json',

         maxHealth: 70,
         attackDamage: 25,
         attackRange: 120,
         attackCooldown: 2000,
         armor: 5,

         movementSpeed: 70,
         detectionRange: 300,
         aggroRange: 250,

         physics: {
            mass: 75,
            friction: 0.5,
            restitution: 0.1,
            linearDamping: 9,
            angularDamping: 11,
            dimensions: { width: 34, height: 34 },
            collisionGroup: CollisionGroups.Enemy,
         },

         aiBehavior: AIBehaviorType.DEFENSIVE,
         abilities: [EnemyAbilityType.ACID_THROW],

         scoreValue: 22,
         level: 1,

         animationFrameRates: {
            [EnemyAnimationState.IDLE]: 2,
            [EnemyAnimationState.MOVE]: 6,
            [EnemyAnimationState.ATTACK]: 8,
            [EnemyAnimationState.ABILITY]: 5,
         },

         statusResistances: {
            slow: 0.1,
            stun: 0.2,
            poison: 1.0, // Immune to poison
            knockback: 0.3,
         },

         targetPriorities: {
            player: 10,
            structures: 6,
         },
      },

      [EnemyType.SWARM]: {
         type: EnemyType.SWARM,
         name: 'Swarm Drone',
         spritePath: './src/game/assets/enemies/enemy-buff.json',

         maxHealth: 20,
         attackDamage: 8,
         attackRange: 25,
         attackCooldown: 800,
         armor: 0,

         movementSpeed: 120,
         detectionRange: 250,
         aggroRange: 200,

         physics: {
            mass: 30,
            friction: 0.2,
            restitution: 0.3,
            linearDamping: 4,
            angularDamping: 6,
            dimensions: { width: 20, height: 20 },
            collisionGroup: CollisionGroups.Enemy,
         },

         aiBehavior: AIBehaviorType.SWARM,
         abilities: [EnemyAbilityType.NONE],

         scoreValue: 5, // Low individual value
         level: 1,

         animationFrameRates: {
            [EnemyAnimationState.IDLE]: 6,
            [EnemyAnimationState.MOVE]: 15,
            [EnemyAnimationState.ATTACK]: 12,
            [EnemyAnimationState.ABILITY]: 8,
         },

         statusResistances: {
            slow: 0.2,
            stun: 0,
            poison: 0,
            knockback: 0.1,
         },

         targetPriorities: {
            player: 15, // Very aggressive
            structures: 2,
         },
      },

      [EnemyType.SMARTASS]: {
         type: EnemyType.SMARTASS,
         name: 'Tactical Unit',
         spritePath: './src/game/assets/enemies/enemy-buff.json',

         maxHealth: 85,
         attackDamage: 22,
         attackRange: 55,
         attackCooldown: 1400,
         armor: 8,

         movementSpeed: 110,
         detectionRange: 400,
         aggroRange: 350,

         physics: {
            mass: 80,
            friction: 0.4,
            restitution: 0.2,
            linearDamping: 7,
            angularDamping: 9,
            dimensions: { width: 35, height: 35 },
            collisionGroup: CollisionGroups.Enemy,
         },

         aiBehavior: AIBehaviorType.STRATEGIC,
         abilities: [EnemyAbilityType.NONE],

         scoreValue: 35,
         level: 1,

         animationFrameRates: {
            [EnemyAnimationState.IDLE]: 2,
            [EnemyAnimationState.MOVE]: 8,
            [EnemyAnimationState.ATTACK]: 6,
            [EnemyAnimationState.ABILITY]: 4,
         },

         statusResistances: {
            slow: 0.3,
            stun: 0.2,
            poison: 0.1,
            knockback: 0.4,
         },

         targetPriorities: {
            player: 7,
            structures: 12, // Highly prioritizes important structures
         },
      },

      [EnemyType.DEFLECTOR]: {
         type: EnemyType.DEFLECTOR,
         name: 'Shield Guardian',
         spritePath: './src/game/assets/enemies/enemy-buff.json',

         maxHealth: 100,
         attackDamage: 18,
         attackRange: 50,
         attackCooldown: 1600,
         armor: 15,

         movementSpeed: 65,
         detectionRange: 320,
         aggroRange: 280,

         physics: {
            mass: 95,
            friction: 0.6,
            restitution: 0.1,
            linearDamping: 11,
            angularDamping: 13,
            dimensions: { width: 38, height: 38 },
            collisionGroup: CollisionGroups.Enemy,
         },

         aiBehavior: AIBehaviorType.DEFENSIVE,
         abilities: [EnemyAbilityType.BULLET_DEFLECTION],

         scoreValue: 28,
         level: 1,

         animationFrameRates: {
            [EnemyAnimationState.IDLE]: 2,
            [EnemyAnimationState.MOVE]: 5,
            [EnemyAnimationState.ATTACK]: 6,
            [EnemyAnimationState.ABILITY]: 8, // Deflection animation
         },

         statusResistances: {
            slow: 0.4,
            stun: 0.3,
            poison: 0.2,
            knockback: 0.6,
         },

         targetPriorities: {
            player: 8,
            structures: 5,
         },
      },
   };

   /**
    * Get enemy properties by type
    */
   public static getTemplate(enemyType: EnemyType): EnemyProperties {
      const template = this.templates[enemyType];
      if (!template) {
         throw new Error(`Enemy template not found for type: ${enemyType}`);
      }
      return { ...template }; // Return a copy to prevent mutations
   }

   /**
    * Get all available enemy types
    */
   public static getAllTypes(): EnemyType[] {
      return Object.keys(this.templates) as EnemyType[];
   }

   /**
    * Create a scaled template for a specific level
    */
   public static getScaledTemplate(enemyType: EnemyType, level: number): EnemyProperties {
      const baseTemplate = this.getTemplate(enemyType);

      if (level <= 1) {
         return baseTemplate;
      }

      // Scale certain properties based on level
      const scaleFactor = 1 + (level - 1) * 0.15; // 15% increase per level
      const healthScaleFactor = 1 + (level - 1) * 0.2; // 20% health increase per level

      return {
         ...baseTemplate,
         maxHealth: Math.floor(baseTemplate.maxHealth * healthScaleFactor),
         attackDamage: Math.floor(baseTemplate.attackDamage * scaleFactor),
         movementSpeed: Math.floor(baseTemplate.movementSpeed * Math.min(scaleFactor, 1.5)), // Cap speed scaling
         scoreValue: Math.floor(baseTemplate.scoreValue * scaleFactor),
         level: level,
      };
   }

   /**
    * Validate that all required enemy types have templates
    */
   public static validateTemplates(): boolean {
      const allTypes = Object.values(EnemyType);
      const templateTypes = Object.keys(this.templates);

      for (const type of allTypes) {
         if (!templateTypes.includes(type)) {
            console.error(`Missing template for enemy type: ${type}`);
            return false;
         }
      }

      return true;
   }
}
