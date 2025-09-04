// shared/src/game/EntityManager.ts

import { Entity } from './Entity';

export class EntityManager {
   private colliderToEntity: Map<number, Entity> = new Map();
   private idToEntity: Map<string, Entity> = new Map();

   public registerEntity(entity: Entity): void {
      this.idToEntity.set(entity.id, entity);

      const colliderHandle = entity.getColliderHandleSafe();
      if (colliderHandle !== null) {
         this.colliderToEntity.set(colliderHandle, entity);
      } else {
         console.warn(`⚠️ Entity ${entity.id} registered without collider handle`);
      }
   }

   public unregisterEntity(entityId: string): void {
      const entity = this.idToEntity.get(entityId);
      if (!entity) {
         console.warn(`Attempted to unregister unknown entity: ${entityId}`);
         return;
      }

      this.idToEntity.delete(entityId);

      const colliderHandle = entity.getColliderHandleSafe();
      if (colliderHandle !== null) {
         const wasRemoved = this.colliderToEntity.delete(colliderHandle);
         if (wasRemoved) {
            console.log(`🗑️ Unregistered entity ${entityId} and removed collider mapping (handle: ${colliderHandle})`);
         } else {
            console.warn(`⚠️ Entity ${entityId} had handle ${colliderHandle} but no collider mapping found`);
         }
      } else {
         console.log(`🗑️ Unregistered entity ${entityId} (no collider handle to remove)`);
      }
   }

   public getEntityByCollider(handle: number): Entity | null {
      const entity = this.colliderToEntity.get(handle);

      return entity || null;
   }

   public getEntityById(id: string): Entity | null {
      return this.idToEntity.get(id) || null;
   }

   public getRegistrationStats(): {
      totalEntities: number;
      entitiesWithColliders: number;
      colliderMappings: number;
      orphanedColliders: number;
   } {
      const entitiesWithColliders = Array.from(this.idToEntity.values()).filter((e) =>
         e.hasValidColliderHandle(),
      ).length;

      // Check for orphaned collider mappings (colliders pointing to entities that don't exist)
      let orphanedColliders = 0;
      for (const [handle, entity] of this.colliderToEntity.entries()) {
         if (!this.idToEntity.has(entity.id)) {
            orphanedColliders++;
            console.warn(`🏚️ Orphaned collider mapping: handle ${handle} -> missing entity ${entity.id}`);
         }
      }

      return {
         totalEntities: this.idToEntity.size,
         entitiesWithColliders,
         colliderMappings: this.colliderToEntity.size,
         orphanedColliders,
      };
   }

   public cleanupOrphanedColliders(): number {
      let cleanedUp = 0;
      const toRemove: number[] = [];

      for (const [handle, entity] of this.colliderToEntity.entries()) {
         if (!this.idToEntity.has(entity.id)) {
            toRemove.push(handle);
         }
      }

      for (const handle of toRemove) {
         this.colliderToEntity.delete(handle);
         cleanedUp++;
      }

      if (cleanedUp > 0) {
         console.log(`🧹 Cleaned up ${cleanedUp} orphaned collider mappings`);
      }

      return cleanedUp;
   }

   public clear(): void {
      this.colliderToEntity.clear();
      this.idToEntity.clear();
   }
}
