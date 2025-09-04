// client/src/game/handlers/EnemyNetworkHandler.ts

import { OnClientMessage } from 'shared/game/network/NetworkMessageDecorators';
import { ClientBound } from 'shared/game/network/SocketEvents';
import {
   EnemyAbilityData,
   EnemyDeathData,
   EnemyDespawnData,
   EnemySpawnData,
   EnemyUpdateData,
   ExplosionEffectData,
   ProjectileSpawnData,
} from 'shared/game/network/messages/EnemyNetworkEvents';
import FrontendGame from '../FrontendGame';
import { EnemyDamageEventBatch } from 'shared/game/network/messages/client-bound/DamageEvents';

export class EnemyNetworkHandler {
   private game: FrontendGame;

   constructor(game: FrontendGame) {
      this.game = game;
   }

   @OnClientMessage(ClientBound.EnemySpawn)
   handleEnemySpawn(data: EnemySpawnData): void {
      const enemyManager = this.game.getEnemyManager();
      if (!enemyManager) {
         console.warn('Enemy manager not available');
         return;
      }

      let newEnemiesSpawned = 0;
      let existingEnemiesSkipped = 0;
      // console.log('ENEMIES DATA', data.enemies.length);

      for (const enemyData of data.enemies) {
         // Check if enemy already exists before attempting to spawn
         if (enemyManager.hasEnemy(enemyData.id)) {
            existingEnemiesSkipped++;
            continue;
         }

         const spawnResult = enemyManager.spawnClientEnemy({
            id: enemyData.id,
            type: enemyData.type,
            level: enemyData.level,
            position: enemyData.position,
            rotation: enemyData.rotation,
            properties: enemyData.properties,
         });

         if (spawnResult) {
            newEnemiesSpawned++;
         }
      }

      if (newEnemiesSpawned > 0) {
         console.log(`✅ Spawned ${newEnemiesSpawned} new enemies`);
      }

      if (existingEnemiesSkipped > 0) {
         console.log(`⚠️ Skipped ${existingEnemiesSkipped} enemies that already exist`);
      }
   }

   @OnClientMessage(ClientBound.EnemyUpdate)
   handleEnemyUpdate(data: EnemyUpdateData): void {
      const enemyManager = this.game.getEnemyManager();
      if (!enemyManager) return;

      for (const enemyData of data.enemies) {
         enemyManager.updateClientEnemy(enemyData);
      }
   }

   @OnClientMessage(ClientBound.EnemyDespawn)
   handleEnemyDespawn(data: EnemyDespawnData): void {
      console.log(`Despawning ${data.enemyIds.length} enemies (reason: ${data.reason})`);

      const enemyManager = this.game.getEnemyManager();
      if (!enemyManager) return;

      for (const enemyId of data.enemyIds) {
         enemyManager.despawnClientEnemy(enemyId, data.reason);
      }
   }

   @OnClientMessage(ClientBound.EnemyAbility)
   handleEnemyAbility(data: EnemyAbilityData): void {
      console.log(`Enemy ${data.enemyId} used ability ${data.abilityType}`);

      const enemyManager = this.game.getEnemyManager();
      if (!enemyManager) return;

      // Update enemy animation state for ability
      // enemyManager.playAbilityAnimation(data.enemyId, data.abilityType);

      // Create visual effects based on ability type
      // this.createAbilityEffects(data);
   }

   @OnClientMessage(ClientBound.EnemyDeath)
   handleEnemyDeath(data: EnemyDeathData): void {
      console.log(`Enemy ${data.enemyId} died at ${data.deathPosition.x}, ${data.deathPosition.y}`);

      const enemyManager = this.game.getEnemyManager();
      if (!enemyManager) return;

      // Play death effects
      // this.createDeathEffects(data);
      //
      // // Award score to killer if it's the local player
      // if (data.killerPlayerId === this.game.getLocalPlayerId()) {
      //    this.game.getUIManager()?.addScore(data.scoreAwarded);
      // }
   }

   @OnClientMessage(ClientBound.EnemyDamage)
   handleEnemyDamage(data: EnemyDamageEventBatch): void {
      console.log(
         `🎯 Received ${data.events.length} enemy damage events at ${this.game.getPhysicsManager().getCurrentTime()}`,
      );
      console.log('EVENTS:', data);

      const enemyManager = this.game.getEnemyManager();
      if (!enemyManager) return;

      data.events.forEach((event) => {
         // Get the ClientEnemy that was damaged (using targetId)
         const clientEnemy = enemyManager.getClientEnemy(event.targetId);

         if (!clientEnemy) {
            console.warn(`ClientEnemy ${event.targetId} not found for damage event`);
            return;
         }

         // Calculate new health after damage
         const newHealth = Math.max(0, clientEnemy.health - event.damage);

         // Update enemy health directly
         clientEnemy.updateHealth(newHealth, clientEnemy.maxHealth);

         console.log(
            `💥 Enemy ${event.targetId} took ${event.damage} damage (${event.armorReduction} blocked by armor) - Health: ${newHealth}/${clientEnemy.maxHealth}`,
         );
      });
   }

   @OnClientMessage(ClientBound.ExplosionEffect)
   handleExplosionEffect(data: ExplosionEffectData): void {
      console.log(`Explosion at ${data.position.x}, ${data.position.y} with radius ${data.radius}`);

      // Create explosion visual effect
      // this.game.getEffectsManager()?.createExplosion({
      //    position: data.position,
      //    radius: data.radius,
      //    damage: data.damage,
      //    type: data.explosionType,
      //    affectedEntities: data.affectedEntityIds,
      // });
   }

   @OnClientMessage(ClientBound.ProjectileSpawn)
   handleProjectileSpawn(data: ProjectileSpawnData): void {
      console.log(`Projectile ${data.projectileType} spawned from enemy ${data.sourceEnemyId}`);

      // Create projectile entity
      // this.game.getProjectileManager()?.createProjectile({
      //    id: data.projectileId,
      //    startPosition: data.startPosition,
      //    targetPosition: data.targetPosition,
      //    velocity: data.velocity,
      //    type: data.projectileType,
      //    damage: data.damage,
      //    sourceId: data.sourceEnemyId,
      //    visualEffects: data.visualEffects,
      // });
   }
}
