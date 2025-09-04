// client/src/game/enemies/ClientEnemyManager.ts

import { EnemyNetworkData, EnemyType } from 'shared/game/enemies/EnemyInterfaces';
import { Position } from 'shared/game/Position';
import { AssetLoader } from '../AssetLoader';
import { RenderManager } from '../rendering/RenderManager';
import { Container } from 'pixi.js';
import type * as RAPIER from '@dimforge/rapier2d-compat';
import { ClientEnemy } from './ClientEnemy';
import FrontendGame from '../FrontendGame';

/**
 * Configuration for spawning client enemies
 */
export interface ClientEnemySpawnConfig {
   id: string;
   type: EnemyType;
   level: number;
   position: Position;
   rotation: number;
   properties?: any;
}

/**
 * Handles rendering and visual updates without complex prediction logic
 */
export class ClientEnemyManager {
   private assetLoader: AssetLoader;
   private renderManager: RenderManager;
   private world?: RAPIER.World;
   private rapier?: typeof RAPIER;
   private game: FrontendGame;

   // Enemy storage
   private enemies = new Map<string, ClientEnemy>();
   private enemiesByType = new Map<EnemyType, Set<string>>();

   // Rendering containers
   private enemyContainer: Container;

   // Update timing
   private lastUpdateTime: number = 0;
   private readonly updateInterval = 16;

   constructor(assetLoader: AssetLoader, renderManager: RenderManager, game: FrontendGame) {
      this.assetLoader = assetLoader;
      this.renderManager = renderManager;
      this.game = game;

      // Create enemy container for rendering
      this.enemyContainer = new Container();
      this.renderManager.mapContainer.addChild(this.enemyContainer);
      this.enemyContainer.zIndex = 8; // Between players and bullets

      console.log('✅ ClientEnemyManager initialized with kinematic approach');
   }

   /**
    * Initialize physics world reference
    */
   public initializePhysics(world: RAPIER.World, rapier: typeof RAPIER): void {
      this.world = world;
      this.rapier = rapier;
      console.log('✅ ClientEnemyManager physics initialized');
   }

   /**
    * Spawn a new client enemy with kinematic body
    */
   public spawnClientEnemy(config: ClientEnemySpawnConfig): ClientEnemy | null {
      if (!this.world || !this.rapier) {
         console.error('Cannot spawn enemy: physics not initialized');
         return null;
      }

      try {
         // Create the client enemy with kinematic body
         const clientEnemy = new ClientEnemy(
            this.world,
            this.rapier,
            config.id,
            config.type,
            config.level,
            config.position,
            config.rotation,
            this.enemyContainer,
            this.assetLoader,
            this.game,
         );

         this.game.getEntityManager().registerEntity(clientEnemy);

         // Store enemy
         this.enemies.set(config.id, clientEnemy);

         // Track by type
         if (!this.enemiesByType.has(config.type)) {
            this.enemiesByType.set(config.type, new Set());
         }
         this.enemiesByType.get(config.type)!.add(config.id);

         // console.log(`✅ Spawned kinematic client enemy: ${config.type} (${config.id})`);

         return clientEnemy;
      } catch (error) {
         console.error('Failed to spawn client enemy:', error);
         return null;
      }
   }

   /**
    * Update a client enemy with network data
    */
   public updateClientEnemy(data: EnemyNetworkData): void {
      const enemy = this.enemies.get(data.id);
      if (!enemy) {
         console.warn(`Received update for unknown enemy: ${data.id}`);
         return;
      }

      // Simple update - let the enemy handle kinematic positioning
      enemy.updateFromServer(data);
   }

   /**
    * Remove a client enemy
    */
   public despawnClientEnemy(enemyId: string, reason: 'death' | 'cleanup' | 'out_of_bounds'): boolean {
      const enemy = this.enemies.get(enemyId);
      if (!enemy) {
         console.warn(`Attempted to despawn unknown enemy: ${enemyId}`);
         return false;
      }

      this.game.getEntityManager().unregisterEntity(enemyId);

      // Remove from type tracking
      const enemyType = enemy.enemyType;
      const typeSet = this.enemiesByType.get(enemyType);
      if (typeSet) {
         typeSet.delete(enemyId);
         if (typeSet.size === 0) {
            this.enemiesByType.delete(enemyType);
         }
      }

      enemy.destroy();

      this.enemies.delete(enemyId);

      // console.log(`🗑️ Despawned client enemy: ${enemyId} (reason: ${reason})`);
      return true;
   }

   /**
    * Handle enemy death with effects
    */
   public handleEnemyDeath(enemyId: string): void {
      const enemy = this.enemies.get(enemyId);
      if (!enemy) {
         console.warn(`Cannot handle death for unknown enemy: ${enemyId}`);
         return;
      }

      // Play death animation
      enemy.playDeathAnimation();

      // Could add death effects here (particles, sound, etc.)
      console.log(`💀 Enemy ${enemyId} died`);
   }

   /**
    * Update all client enemies (called every frame)
    */
   public update(): void {
      const currentTime = performance.now();

      // Throttle updates to maintain performance
      if (currentTime - this.lastUpdateTime < this.updateInterval) {
         return;
      }

      for (const enemy of this.enemies.values()) {
         enemy.update();
      }

      this.lastUpdateTime = currentTime;
   }

   /**
    * Get client enemy by ID
    */
   public getClientEnemy(enemyId: string): ClientEnemy | undefined {
      return this.enemies.get(enemyId);
   }

   /**
    * Get all client enemies of a specific type
    */
   public getClientEnemiesByType(enemyType: EnemyType): ClientEnemy[] {
      const enemyIds = this.enemiesByType.get(enemyType) || new Set();
      return Array.from(enemyIds)
         .map((id) => this.enemies.get(id))
         .filter(Boolean) as ClientEnemy[];
   }

   /**
    * Get all client enemies
    */
   public getAllClientEnemies(): ClientEnemy[] {
      return Array.from(this.enemies.values());
   }

   /**
    * Get enemy count
    */
   public getEnemyCount(enemyType?: EnemyType): number {
      if (enemyType) {
         return this.enemiesByType.get(enemyType)?.size || 0;
      }
      return this.enemies.size;
   }

   /**
    * Check if enemy exists
    */
   public hasEnemy(enemyId: string): boolean {
      return this.enemies.has(enemyId);
   }

   /**
    * Clear all enemies (for game reset)
    */
   public clearAllEnemies(): void {
      console.log(`🧹 Clearing ${this.enemies.size} client enemies`);

      for (const enemy of this.enemies.values()) {
         enemy.destroy();
      }

      this.enemies.clear();
      this.enemiesByType.clear();
   }

   /**
    * Get debug information
    */
   public getDebugInfo(): string {
      const enemyCount = this.enemies.size;
      const typeBreakdown = Array.from(this.enemiesByType.entries())
         .map(([type, ids]) => `${type}: ${ids.size}`)
         .join(', ');

      return `Enemies: ${enemyCount} (${typeBreakdown})`;
   }

   /**
    * Cleanup when manager is destroyed
    */
   public destroy(): void {
      this.clearAllEnemies();

      if (this.enemyContainer.parent) {
         this.enemyContainer.parent.removeChild(this.enemyContainer);
      }
      this.enemyContainer.destroy();

      console.log('🗑️ ClientEnemyManager destroyed');
   }
}
