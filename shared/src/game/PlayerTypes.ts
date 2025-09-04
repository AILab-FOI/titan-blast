import { MovementController } from './movement/MovementController';
import { Player } from './Player';
import { GunType } from './shooting/GunTypes';
import { Position } from './Position';
import * as RAPIER from '@dimforge/rapier2d-compat';
import { CollisionGroups } from './CollisionSettings';
import { pixelToPhysics } from '../util/Utils';
import { CharacterMovementController } from './movement/CharacterMovementController';

export enum PlayerTypeEnum {
   Tank = 'tank',
   Assault = 'assault',
   Sniper = 'sniper',
}

export enum EntityShape {
   Cuboid = 'cuboid',
   Circle = 'circle',
   Capsule = 'capsule',
}

export enum AnimationState {
   IDLE = 'idle',
   MOVE = 'move',
   DEATH = 'death',
}

export interface PlayerColliderConfig {
   shape: EntityShape;
   // For cuboid: width and height
   // For circle: radius
   // For capsule: radius and height
   dimensions: {
      width?: number;
      height?: number;
      radius?: number;
   };
   offset?: Position; // Offset from player center
   // Physics material properties
   friction: number;
   restitution: number;
   density: number; // Used for automatic mass calculation
   sensor?: boolean;
}

export interface PlayerPhysicsConfig {
   // RigidBody properties
   bodyType: RAPIER.RigidBodyType;
   lockRotation?: boolean;
   linearDamping: number;
   angularDamping: number;
   canSleep?: boolean;
   ccdEnabled?: boolean;

   // Collider configuration
   collider: PlayerColliderConfig;
}

export interface GunConfig {
   type: GunType;
   positionOffset: Position;
}

export interface AnimationFrameRates {
   [AnimationState.IDLE]?: number; // Frames per second for idle animation
   [AnimationState.MOVE]?: number; // Frames per second for moving animation
   [AnimationState.DEATH]?: number; // Frames per second for death animation
}

export interface PlayerType {
   id: PlayerTypeEnum;
   name: string;
   spritePath: string;

   // Gameplay properties
   maxHealth: number;
   movementSpeed: number;
   rotationalSpeed?: number;
   viewDistance: number;

   // Physics configuration
   physics: PlayerPhysicsConfig;

   // Movement control
   movementController: new (player: Player) => MovementController;

   // Weapons configuration
   guns: GunConfig[];

   animationFrameRates?: AnimationFrameRates;
}

export function createPlayerPhysics(
   rapier: typeof RAPIER,
   config: PlayerPhysicsConfig,
): { rigidBodyDesc: RAPIER.RigidBodyDesc; colliderDesc: RAPIER.ColliderDesc } {
   // Create RigidBody descriptor
   const bodyDesc = rapier.RigidBodyDesc.kinematicPositionBased()
      .setLinearDamping(config.linearDamping)
      .setAngularDamping(config.angularDamping);

   if (config.lockRotation) {
      bodyDesc.lockRotations();
   }

   if (config.canSleep !== undefined) {
      bodyDesc.setCanSleep(config.canSleep);
   }

   if (config.ccdEnabled !== undefined) {
      bodyDesc.setCcdEnabled(config.ccdEnabled);
   }

   // Create Collider descriptor based on shape
   let colliderDesc: RAPIER.ColliderDesc;
   const c = config.collider;

   switch (c.shape) {
      case EntityShape.Cuboid:
         if (!c.dimensions.width || !c.dimensions.height) {
            throw new Error('Cuboid collider requires width and height');
         }
         colliderDesc = rapier.ColliderDesc.cuboid(
            pixelToPhysics(c.dimensions.width) / 2,
            pixelToPhysics(c.dimensions.height) / 2,
         );
         break;

      case EntityShape.Circle:
         if (!c.dimensions.radius) {
            throw new Error('Circle collider requires radius');
         }
         colliderDesc = rapier.ColliderDesc.ball(c.dimensions.radius);
         break;

      case EntityShape.Capsule:
         if (!c.dimensions.radius || !c.dimensions.height) {
            throw new Error('Capsule collider requires radius and height');
         }
         colliderDesc = rapier.ColliderDesc.capsule(pixelToPhysics(c.dimensions.height) / 2, c.dimensions.radius);
         break;

      default:
         throw new Error(`Unsupported collider shape: ${c.shape}`);
   }

   // Set collider properties
   colliderDesc
      .setDensity(c.density)
      .setFriction(c.friction)
      .setRestitution(c.restitution)
      .setCollisionGroups(CollisionGroups.Player)
      // .setSolverGroups(CollisionMasks.PLAYER_MASK)
      .setActiveCollisionTypes(RAPIER.ActiveCollisionTypes.ALL)
      .setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS);

   // if (c.offset) {
   //    colliderDesc.setTranslation(c.offset.x, c.offset.y);
   // }
   //
   // if (c.sensor) {
   //    colliderDesc.setSensor(true);
   // }

   return { rigidBodyDesc: bodyDesc, colliderDesc };
}

export function createPlayerTypeConfigs(rapier: typeof RAPIER): Record<PlayerTypeEnum, PlayerType> {
   return {
      [PlayerTypeEnum.Tank]: {
         id: PlayerTypeEnum.Tank,
         name: 'Tank',
         spritePath: './src/game/assets/characters/tank-character.json',
         maxHealth: 200,
         movementSpeed: 1,
         rotationalSpeed: 10,
         viewDistance: 1,
         physics: {
            bodyType: rapier.RigidBodyType.Dynamic,
            linearDamping: 10,
            angularDamping: 400,
            canSleep: false,
            ccdEnabled: true,
            collider: {
               shape: EntityShape.Cuboid,
               dimensions: {
                  width: 60,
                  height: 100,
               },
               friction: 0.2,
               restitution: 0.2,
               density: 2.0,
            },
         },
         movementController: CharacterMovementController,
         guns: [
            {
               type: GunType.TANK_RIFLE,
               positionOffset: { x: 0, y: 0 },
            },
         ],
         animationFrameRates: {
            [AnimationState.IDLE]: 2,
            [AnimationState.MOVE]: 8,
            [AnimationState.DEATH]: 4,
         },
      },
      [PlayerTypeEnum.Assault]: {
         id: PlayerTypeEnum.Assault,
         name: 'Assault',
         spritePath: './src/game/assets/characters/military1-character.json',
         maxHealth: 100,
         movementSpeed: 300,
         viewDistance: 1.2,
         physics: {
            bodyType: rapier.RigidBodyType.KinematicPositionBased,
            linearDamping: 0,
            angularDamping: 0,
            canSleep: false,
            ccdEnabled: false,
            lockRotation: true,
            collider: {
               shape: EntityShape.Cuboid,
               dimensions: {
                  width: 40,
                  height: 80,
               },
               friction: 0,
               restitution: 0,
               density: 1.0,
            },
         },
         movementController: CharacterMovementController,
         guns: [
            {
               type: GunType.ASSAULT_RIFLE,
               positionOffset: { x: -10, y: 0 },
            },
         ],
         animationFrameRates: {
            [AnimationState.IDLE]: 20,
            [AnimationState.MOVE]: 15,
            [AnimationState.DEATH]: 4,
         },
      },

      [PlayerTypeEnum.Sniper]: {
         id: PlayerTypeEnum.Sniper,
         name: 'Marksman',
         spritePath: './src/game/assets/characters/military2-character.json',
         maxHealth: 80,
         movementSpeed: 220,
         viewDistance: 0.8,
         physics: {
            bodyType: rapier.RigidBodyType.KinematicPositionBased,
            linearDamping: 0,
            angularDamping: 0,
            canSleep: false,
            ccdEnabled: false,
            lockRotation: true,
            collider: {
               shape: EntityShape.Cuboid,
               dimensions: {
                  width: 50,
                  height: 80,
               },
               friction: 0,
               restitution: 0,
               density: 0.8,
            },
         },
         movementController: CharacterMovementController,
         guns: [
            {
               type: GunType.SNIPER,
               positionOffset: { x: -20, y: -5 },
            },
         ],
         animationFrameRates: {
            [AnimationState.IDLE]: 6,
            [AnimationState.MOVE]: 8,
            [AnimationState.DEATH]: 3,
         },
      },
   };
}
