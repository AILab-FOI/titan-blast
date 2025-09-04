// shared/src/game/map-system/MapPhysicsElement.ts

import type * as RAPIER from '@dimforge/rapier2d-compat';
import { v4 as uuidv4 } from 'uuid';
import { MapLayer, TileType } from './MapTypes';
import { CollisionGroups } from '../CollisionSettings';
import { Entity } from '../Entity';
import { Position } from '../Position';
import { pixelToPhysics } from '../../util/Utils';

/**
 * Physics properties for different tile types
 */
interface PhysicsProperties {
   isDynamic: boolean;
   isSensor: boolean;
   density: number;
   friction: number;
   restitution: number;
   collisionGroup: number;
}

/**
 * Default physics properties for different tile types
 */
const PHYSICS_DEFAULTS: Record<TileType, PhysicsProperties> = {
   [TileType.Ground]: {
      isDynamic: false,
      isSensor: false,
      density: 1.0,
      friction: 0.3,
      restitution: 0.0,
      collisionGroup: CollisionGroups.Obstacle,
   },
   [TileType.Wall]: {
      isDynamic: false,
      isSensor: false,
      density: 2.0,
      friction: 0.5,
      restitution: 0.1,
      collisionGroup: CollisionGroups.Obstacle,
   },
};

/**
 * Class representing a physics-enabled map element
 */
export class MapPhysicsElement extends Entity {
   private tileType: TileType;
   private tilePosition: Position;
   private layer: MapLayer;
   private rapier: typeof RAPIER;
   private tileSize: number;

   /**
    * Create a new physics element for a map tile
    *
    * @param world RAPIER physics world
    * @param rapier RAPIER module
    * @param tileType Type of the tile
    * @param position World position of the tile
    * @param layer Map layer this element belongs to
    * @param tileSize Size of the tile in pixels (required)
    */
   constructor(
      world: RAPIER.World,
      rapier: typeof RAPIER,
      tileType: TileType,
      position: Position,
      layer: MapLayer = MapLayer.Walls,
      tileSize: number,
   ) {
      super(world, uuidv4());

      this.rapier = rapier;
      this.tileType = tileType;
      this.tilePosition = position;
      this.layer = layer;
      this.tileSize = tileSize;

      if (!tileSize || tileSize <= 0) {
         throw new Error('MapPhysicsElement requires a valid tileSize parameter');
      }
   }

   /**
    * Get the position of this element
    */
   public getPosition(): Position {
      return this.tilePosition;
   }

   /**
    * Create the physics body for this map element
    */
   protected createBody(position: Position, rotation: number): RAPIER.RigidBody {
      // Get base physics properties for this tile type
      const physicsProps = PHYSICS_DEFAULTS[this.tileType];

      // Calculate center position for the tile
      const centerPosition = {
         x: position.x + this.tileSize / 2,
         y: position.y + this.tileSize / 2,
      };

      // Create rigid body descriptor
      let bodyDesc: RAPIER.RigidBodyDesc;

      if (physicsProps.isDynamic) {
         bodyDesc = this.rapier.RigidBodyDesc.dynamic()
            .setTranslation(pixelToPhysics(centerPosition.x), pixelToPhysics(centerPosition.y))
            .setRotation(rotation);
      } else {
         bodyDesc = this.rapier.RigidBodyDesc.fixed()
            .setTranslation(pixelToPhysics(centerPosition.x), pixelToPhysics(centerPosition.y))
            .setRotation(rotation);
      }

      // Create the rigid body
      const body = this.world.createRigidBody(bodyDesc);

      // Create collider descriptor as a cuboid
      const colliderDesc = this.rapier.ColliderDesc.cuboid(
         pixelToPhysics(this.tileSize / 2),
         pixelToPhysics(this.tileSize / 2),
      );

      // Set physics properties
      colliderDesc
         .setDensity(physicsProps.density)
         .setFriction(physicsProps.friction)
         .setRestitution(physicsProps.restitution)
         .setCollisionGroups(physicsProps.collisionGroup);

      if (physicsProps.isSensor) {
         colliderDesc.setSensor(true);
      }

      // Create the collider and attach it to the body
      this.world.createCollider(colliderDesc, body);

      return body;
   }

   /**
    * Check if this element is physically blocking
    */
   public isBlocking(): boolean {
      return this.tileType === TileType.Wall;
   }

   /**
    * Get the tile type
    */
   public getTileType(): TileType {
      return this.tileType;
   }

   /**
    * Get the map layer
    */
   public getLayer(): MapLayer {
      return this.layer;
   }

   /**
    * Called when the entity spawns in the world
    */
   protected onSpawn(): void {
   }

   /**
    * Called when the entity is removed from the world
    */
   protected onDespawn(): void {
   }

   /**
    * Serialize this element for network transmission
    */
   public serialize(): any {
      return {
         id: this.id,
         position: this.tilePosition,
         tileType: this.tileType,
         layer: this.layer,
      };
   }

   /**
    * Create a MapPhysicsElement from serialized data
    */
   public static deserialize(
      data: any,
      world: RAPIER.World,
      rapier: typeof RAPIER,
      tileSize: number,
   ): MapPhysicsElement {
      const element = new MapPhysicsElement(world, rapier, data.tileType, data.position, data.layer, tileSize);

      return element;
   }
}