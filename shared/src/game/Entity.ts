import { Position } from './Position';
import { v4 } from 'uuid';
import type * as RAPIER from '@dimforge/rapier2d-compat';
import { RigidBody, World } from '@dimforge/rapier2d-compat';
import { physicsToPixel } from '../util/Utils';
import { ManagedEntity } from './Interfaces';
import { gameSettings } from './SystemSettings';

export abstract class Entity implements ManagedEntity {
   body!: RigidBody;
   world: World;
   id: string;
   public isSpawned: boolean = false;
   private cachedPosition: Position | null = null;
   private lastPositionCacheTime: number = -1;

   private cachedColliderHandle: number | null = null;

   constructor(world: RAPIER.World, id?: string) {
      this.world = world;
      this.id = id ? id : v4();
   }

   public get position(): Position {
      if (!this.body) throw new Error('Attempted to get body position before it was summoned');

      const now = Date.now();

      if (this.cachedPosition && now - this.lastPositionCacheTime < gameSettings.gameUpdateIntervalMillis / 2) {
         return this.cachedPosition;
      }

      try {
         const physicsPos = this.body.translation();
         this.cachedPosition = {
            x: physicsToPixel(physicsPos.x),
            y: physicsToPixel(physicsPos.y),
         };
         this.lastPositionCacheTime = now;
      } catch (error) {
         if (this.cachedPosition) {
            console.warn(`Entity ${this.id}: Using cached position, physics body may be removed`);
            return this.cachedPosition;
         }
         throw error;
      }

      return this.cachedPosition;
   }

   public spawn(position: Position, rotation: number): void {
      if (this.isSpawned) return;

      // Create physics body and add to world
      this.body = this.createBody(position, rotation);

      try {
         this.cachedColliderHandle = this.body.collider(0).handle;
      } catch (error) {
         console.error(`Entity ${this.id}: Failed to cache collider handle:`, error);
         this.cachedColliderHandle = null;
      }

      this.isSpawned = true;

      // Allow subclasses to add custom spawn behavior
      this.onSpawn();
   }

   public despawn(): void {
      if (!this.isSpawned) return;

      const finalPosition = this.position;

      const handleToLog = this.cachedColliderHandle;
      this.cachedColliderHandle = null;

      // Remove from physics world
      try {
         this.world.removeRigidBody(this.body);
      } catch (error) {
         console.error(`Entity ${this.id}: Error removing physics body:`, error);
      }

      this.cachedPosition = finalPosition;
      this.lastPositionCacheTime = Date.now();

      this.isSpawned = false;
      this.onDespawn();
   }

   protected abstract createBody(position: Position, rotation: number): RAPIER.RigidBody;

   protected onSpawn(): void {}

   protected onDespawn(): void {}

   getColliderHandle(): number {
      // Return cached handle if available
      if (this.cachedColliderHandle !== null) {
         return this.cachedColliderHandle;
      }

      // If no cached handle, try to get it from body (if body still exists)
      if (this.body && this.isSpawned) {
         try {
            const handle = this.body.collider(0).handle;
            console.log(`📛📛📛📛📛 HANDLE Entity ${this.id}: Collider handle ${handle}`);
            this.cachedColliderHandle = handle; // Cache it for future use
            return handle;
         } catch (error) {
            console.error(`Entity ${this.id}: Failed to get collider handle from body:`, error);
            throw new Error(`Entity ${this.id}: Cannot get collider handle - entity may be despawned`);
         }
      }

      throw new Error(`Entity ${this.id}: Cannot get collider handle - entity not spawned or already despawned`);
   }

   hasValidColliderHandle(): boolean {
      return this.cachedColliderHandle !== null;
   }

   getColliderHandleSafe(): number | null {
      try {
         return this.getColliderHandle();
      } catch (error) {
         return null;
      }
   }
}
