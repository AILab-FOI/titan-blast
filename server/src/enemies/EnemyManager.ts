// server/src/enemies/EnemyManager.ts

import type * as RAPIER from '@dimforge/rapier2d-compat';
import { BaseEnemy } from 'shared/game/enemies/BaseEnemy';
import { EnemyFactory } from 'shared/game/enemies/ConcreteEnemies';
import { EnemySpawnConfig, EnemyType } from 'shared/game/enemies/EnemyInterfaces';
import { Position } from 'shared/game/Position';
import { EntityManager } from 'shared/game/EntityManager';
import { GameEventEmitter } from 'shared/game/events/GameEventEmitter';
import { EnemyDeathEvent, EnemySpawnEvent } from 'shared/game/events/events/EnemyEvents';
import { TaskPriority } from 'shared/util/TaskScheduler';
import { ClientBound } from 'shared/game/network/SocketEvents';
import { EnemyNetworkEventBuilder } from 'shared/game/network/messages/EnemyNetworkEvents';
import { EnemySpawner } from './EnemySpawner';
import { BackendMapSystem } from '../map-system/BackendMapSystem';
import { PlayerManager } from '../PlayerManager';
import { BackendGame } from '../BackendGame';
import { PathfindingManager } from '../pathfinding/PathfindingManager';
import { gameSettings } from 'shared/game/SystemSettings';
import { EnemyDeltaManager } from './EnemyDeltaManager';

export interface EnemySpawnerConfig {
   enabled: boolean;
   spawnInterval: number;
   maxEnemiesPerSpawn: number;
   maxTotalEnemies: number;
   difficultyMultiplier: number;
   spawnAreas: Array<{
      center: Position;
      radius: number;
      allowedTypes: EnemyType[];
   }>;
}

export class EnemyManager {
   private world: RAPIER.World;
   private rapier: typeof RAPIER;
   private entityManager: EntityManager;
   private serverTransport: any;
   private game: BackendGame;

   private pathfindingManager: PathfindingManager;

   private enemies: Map<string, BaseEnemy> = new Map();
   private enemiesByType: Map<EnemyType, Set<string>> = new Map();

   private spawnerConfig: EnemySpawnerConfig;
   private lastSpawnTime: number = 0;
   private enemySpawner: EnemySpawner;

   private deltaManager: EnemyDeltaManager = new EnemyDeltaManager();

   // Performance metrics
   private metrics = {
      totalEnemiesSpawned: 0,
      totalEnemiesKilled: 0,
      activeEnemies: 0,
      averageUpdateTime: 0,
   };

   constructor(
      world: RAPIER.World,
      rapier: typeof RAPIER,
      entityManager: EntityManager,
      serverTransport: any,
      game: any,
      mapSystem: BackendMapSystem,
      playerManager: PlayerManager,
   ) {
      this.world = world;
      this.rapier = rapier;
      this.entityManager = entityManager;
      this.serverTransport = serverTransport;
      this.game = game;

      this.pathfindingManager = new PathfindingManager(world, rapier);

      // Initialize enemy type tracking
      for (const enemyType of Object.values(EnemyType)) {
         this.enemiesByType.set(enemyType, new Set());
      }

      // Default spawner configuration
      this.spawnerConfig = {
         enabled: true,
         spawnInterval: 2, // 5 seconds
         maxEnemiesPerSpawn: 5,
         maxTotalEnemies: 15,
         difficultyMultiplier: 1.0,
         spawnAreas: [
            {
               center: { x: 500, y: 500 },
               radius: 10000,
               allowedTypes: [EnemyType.TANKY, EnemyType.DEFAULT, EnemyType.SPEEDY],
            },
         ],
      };

      this.enemySpawner = new EnemySpawner(this.world, this.rapier, mapSystem, playerManager);

      this.registerEventListeners();
      this.initializeScheduledTasks();

      console.log('EnemyManager initialized with task-based system');
   }

   /**
    * Initialize steering for an enemy based on its AI behavior
    */
   private initializeEnemySteering(enemy: BaseEnemy): void {
      const aiBehavior = enemy.getAIBehavior();

      if (aiBehavior && typeof aiBehavior.createSteeringConfig === 'function') {
         const steeringController = aiBehavior.createSteeringConfig();
         enemy.setSteeringController(steeringController);

         // console.log(`Initialized steering for enemy ${enemy.id} with AI ${aiBehavior.type}`);
      }
   }

   /**
    * Set up centralized scheduled tasks with separated movement and pathfinding
    */
   private initializeScheduledTasks(): void {
      const gameLoop = this.game.getPhysicsManager();

      const mapSystem = this.game.getMapSystem();
      if (mapSystem) {
         this.pathfindingManager.initialize(mapSystem);
      } else {
         console.warn('EnemyManager: No map system available for pathfinding initialization');
      }

      gameLoop.scheduleRepeatingTask(
         () => this.updateAllEnemyMovement(),
         gameSettings.enemyMovementUpdateTicks,
         0,
         TaskPriority.NORMAL,
      );

      gameLoop.scheduleRepeatingTask(
         () => this.updateAllEnemyTargeting(),
         gameSettings.enemyTargetingUpdateTicks,
         0,
         TaskPriority.NORMAL,
      );

      this.initializeStaggeredPathfinding(gameLoop);

      gameLoop.scheduleRepeatingTask(
         () => this.updateAllEnemyAbilities(),
         gameSettings.enemyAbilityUpdateTicks,
         0,
         TaskPriority.NORMAL,
      );

      gameLoop.scheduleRepeatingTask(
         () => this.handleSpawning(),
         gameSettings.enemySpawnUpdateTicks,
         0,
         TaskPriority.LOW,
      );

      console.log('SCHEDULING NETOWKR ENEMY UPDATES');
      gameLoop.scheduleRepeatingTask(
         () => this.sendNetworkUpdates(),
         gameSettings.enemyNetworkUpdateTicks,
         0,
         TaskPriority.HIGH,
      );
   }

   /**
    * Register event listeners
    */
   private registerEventListeners(): void {
      const eventEmitter = GameEventEmitter.getInstance();

      eventEmitter.on(EnemyDeathEvent, (event: EnemyDeathEvent) => {
         this.handleEnemyDeath(event);
      });
   }

   /**
    * Initialize staggered pathfinding system
    * Runs pathfinding calculations separately from movement
    */
   private initializeStaggeredPathfinding(gameLoop: any): void {
      console.log('🔄 Initializing staggered pathfinding system...');

      // Create 10 staggered pathfinding tasks, each running every 5 ticks
      // This gives us a 50-tick cycle (10 * 5 = 50 ticks) with pathfinding spread evenly
      for (let i = 0; i < 10; i++) {
         gameLoop.scheduleRepeatingTask(
            () => this.updateEnemyPathfindingBatch(i),
            gameSettings.enemyPathfindingBatchTicks,
            i,
            TaskPriority.LOW,
         );
      }

      console.log('✅ Set up 10 staggered pathfinding batches, each processing ~10% of enemies every 5 ticks');
   }

   /**
    * Update pathfinding for a specific batch of enemies (10% each)
    * This triggers pathfinding recalculation, separate from movement
    */
   private updateEnemyPathfindingBatch(batchIndex: number): void {
      const enemies = Array.from(this.enemies.values());
      const totalEnemies = enemies.length;

      if (totalEnemies === 0) return;

      // Calculate which enemies belong to this batch
      const batchSize = Math.ceil(totalEnemies / 10); // 10% of enemies
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, totalEnemies);

      // Get enemies for this batch
      const batchEnemies = enemies.slice(startIndex, endIndex);

      if (batchEnemies.length > 0) {
         // console.log(
         //    `🧭 Pathfinding Batch ${batchIndex}: Updating paths for ${batchEnemies.length} enemies (${startIndex}-${endIndex - 1} of ${totalEnemies})`,
         // );

         // Trigger pathfinding recalculation for this batch
         for (const enemy of batchEnemies) {
            if (enemy.getTarget()) {
               // Force pathfinding recalculation by invalidating current path
               this.pathfindingManager.invalidateEnemyPath(enemy.id);
            }
         }
      }
   }

   /**
    * Update movement for ALL enemies in one task
    */
   private updateAllEnemyMovement(): void {
      for (const enemy of this.enemies.values()) {
         enemy.performMovement();
      }
   }

   /**
    * Update targeting for ALL enemies in one task
    */
   private updateAllEnemyTargeting(): void {
      // Get available entities once for all enemies
      const playersMap = this.game.getPlayerManager().getPlayers();
      const availableEntities = {
         players: Array.from(playersMap.values()), // .values() extracts just the BackendPlayer objects
         structures: [],
      };

      // Update targeting for all enemies
      for (const enemy of this.enemies.values()) {
         enemy.updateTargeting(availableEntities);
      }
   }

   /**
    * Update abilities for ALL enemies in one task
    */
   private updateAllEnemyAbilities(): void {
      for (const enemy of this.enemies.values()) {
         enemy.performAbilities();
      }
   }

   /**
    * Spawn a single enemy (no longer sends individual notifications)
    */
   public spawnEnemy(config: EnemySpawnConfig): BaseEnemy | null {
      try {
         if (this.enemies.size >= this.spawnerConfig.maxTotalEnemies) {
            console.warn('Cannot spawn enemy: max enemy limit reached');
            return null;
         }

         const enemy = EnemyFactory.createEnemy(config.enemyType, this.world, this.rapier, config.level || 1);

         if (config.customProperties) {
            // Apply custom modifications
         }

         enemy.setPathfindingService(this.pathfindingManager);

         this.initializeEnemySteering(enemy);
         this.setupEnemyNearbyQuery(enemy);

         enemy.spawn(config.position, 0);

         this.entityManager.registerEntity(enemy);
         this.enemies.set(enemy.id, enemy);
         this.enemiesByType.get(config.enemyType)?.add(enemy.id);

         this.metrics.totalEnemiesSpawned++;
         this.metrics.activeEnemies = this.enemies.size;

         GameEventEmitter.getInstance().emit(new EnemySpawnEvent(enemy, config));

         // console.log(`✅ Spawned ${config.enemyType} enemy at ${config.position.x}, ${config.position.y}`);

         return enemy;
      } catch (error) {
         console.error('Failed to spawn enemy:', error);
         return null;
      }
   }

   /**
    * Spawn multiple enemies (sends batch notification)
    */
   public spawnEnemies(configs: EnemySpawnConfig[]): BaseEnemy[] {
      const spawnedEnemies: BaseEnemy[] = [];

      for (const config of configs) {
         const enemy = this.spawnEnemy(config);
         if (enemy) {
            spawnedEnemies.push(enemy);
         }
      }

      if (spawnedEnemies.length > 0) {
         this.sendSpawnNotification(spawnedEnemies);
      }

      return spawnedEnemies;
   }

   /**
    * Update enemy targeting - called by scheduled task
    */
   private updateEnemyTargeting(): void {
      const availableEntities = {
         players: Array.from(this.game.getPlayerManager().getPlayers()),
         structures: [], // TODO: Add when structures are implemented
      };

      // Update targeting for all enemies
      for (const enemy of this.enemies.values()) {
         enemy.updateTargeting(availableEntities);
      }
   }


   /**
    * Handle automatic spawning
    */
   private handleSpawning(): void {
      if (!this.spawnerConfig.enabled) return;

      const currentTime = Date.now();

      if (currentTime - this.lastSpawnTime < this.spawnerConfig.spawnInterval) {
         return;
      }

      const enemiesToSpawn = Math.min(
         this.spawnerConfig.maxEnemiesPerSpawn,
         this.spawnerConfig.maxTotalEnemies - this.enemies.size,
      );

      if (enemiesToSpawn <= 0) return;

      const spawnConfigs = this.enemySpawner.generateValidatedSpawnConfigs(
         this.spawnerConfig.spawnAreas,
         enemiesToSpawn,
         this.spawnerConfig.difficultyMultiplier,
      );

      if (spawnConfigs.length > 0) {
         this.spawnEnemies(spawnConfigs);
         this.lastSpawnTime = currentTime;
      }
   }

   /**
    * Send network updates to clients (delta updates)
    */
   private sendNetworkUpdates(): void {
      const enemies = this.getAllEnemies();
      const deltaUpdates = this.deltaManager.getDeltaUpdates(enemies);

      if (deltaUpdates.length > 0) {
         // Use the existing buildDeltaUpdateData method
         const updateData = EnemyNetworkEventBuilder.buildDeltaUpdateData(
            deltaUpdates,
            this.game.getPhysicsManager().getGameTick(),
            this.game.getPhysicsManager().getCurrentTime(),
         );

         this.serverTransport.broadcast(ClientBound.EnemyUpdate, updateData);
         // console.log(`📡 Sent delta updates for ${deltaUpdates.length} enemies`);
      }
   }

   /**
    * Send enemy spawn notification to clients
    */
   private sendSpawnNotification(enemies: BaseEnemy[]): void {
      const spawnData = EnemyNetworkEventBuilder.buildSpawnData(
         enemies.map((enemy) => ({
            id: enemy.id,
            type: enemy.enemyType,
            level: enemy.level,
            position: enemy.position,
            rotation: enemy.rotationDegrees,
         })),
      );

      this.serverTransport.broadcast(ClientBound.EnemySpawn, spawnData);
      // console.log(`📡 Broadcasted enemy spawn to clients: ${enemies.length} enemies`);
   }

   /**
    * Remove an enemy from the game
    */
   public despawnEnemy(enemyId: string, reason: 'death' | 'cleanup' | 'out_of_bounds' = 'cleanup'): boolean {
      const enemy = this.enemies.get(enemyId);
      if (!enemy) {
         console.warn(`Attempted to despawn non-existent enemy: ${enemyId}`);
         return false;
      }

      console.log(`🗑️ Starting despawn of enemy ${enemyId} (reason: ${reason})`);

      const colliderHandle = enemy.getColliderHandleSafe();

      this.enemiesByType.get(enemy.enemyType)?.delete(enemyId);
      this.enemies.delete(enemyId);
      this.pathfindingManager.removeEnemy(enemyId);

      try {
         if (enemy.body && enemy.isSpawned) {
            console.log(`🔧 Removing physics body for enemy ${enemyId} (collider: ${colliderHandle})`);
            enemy.despawn();
            console.log(`✅ Physics body removed for enemy ${enemyId}`);
         } else {
            console.log(`⚠️ Enemy ${enemyId} has no physics body to remove (already despawned?)`);
         }
      } catch (error) {
         console.error(`❌ Failed to despawn physics body for enemy ${enemyId}:`, error);
         // Continue with cleanup even if physics despawn fails
      }

      this.entityManager.unregisterEntity(enemyId);

      this.deltaManager.onEnemyRemoved(enemyId);

      this.sendDespawnNotification([enemyId], reason);
      // }

      // Update metrics
      this.metrics.activeEnemies = this.enemies.size;
      if (reason === 'death') {
         this.metrics.totalEnemiesKilled++;
      }

      console.log(`✅ Successfully despawned enemy ${enemyId} (reason: ${reason})`);

      return true;
   }

   /**
    * Send enemy despawn notification to clients
    */
   private sendDespawnNotification(enemyIds: string[], reason: 'death' | 'cleanup' | 'out_of_bounds'): void {
      const despawnData = EnemyNetworkEventBuilder.buildDespawnData(enemyIds, reason);
      this.serverTransport.broadcast(ClientBound.EnemyDespawn, despawnData);
   }

   /**
    * Handle enemy death
    */
   private handleEnemyDeath(event: EnemyDeathEvent): void {
      const enemy = event.enemy;

      const deathData = EnemyNetworkEventBuilder.buildDeathData(
         enemy.id,
         enemy.position,
         event.scoreValue,
         event.killer?.id,
      );

      this.serverTransport.broadcast(ClientBound.EnemyDeath, deathData);
      console.log(`📡 Broadcasted enemy death to clients: ${enemy.id}`);

      this.despawnEnemy(enemy.id, 'death');
   }

   public getEnemy(enemyId: string): BaseEnemy | undefined {
      return this.enemies.get(enemyId);
   }

   public getAllEnemies(): BaseEnemy[] {
      return Array.from(this.enemies.values());
   }

   public getEnemyCount(enemyType?: EnemyType): number {
      if (enemyType) {
         return this.enemiesByType.get(enemyType)?.size || 0;
      }
      return this.enemies.size;
   }

   public getMetrics() {
      return { ...this.metrics };
   }

   /**
    * Get pathfinding manager (for external access)
    */
   public getPathfindingManager(): PathfindingManager {
      return this.pathfindingManager;
   }

   /**
    * Get pathfinding statistics (for monitoring)
    */
   public getPathfindingStats(): any {
      return this.pathfindingManager.getStats();
   }

   /**
    * Clear pathfinding cache (useful when map changes)
    */
   public clearPathfindingCache(): void {
      this.pathfindingManager.clearCache();
   }

   /**
    * Get nearby enemies within radius (for steering calculations)
    * Uses efficient distance checking without square root
    */
   public getNearbyEnemies(position: Position, radius: number, excludeId?: string): BaseEnemy[] {
      const nearby: BaseEnemy[] = [];
      const radiusSquared = radius * radius;

      for (const enemy of this.enemies.values()) {
         if (excludeId && enemy.id === excludeId) continue;

         const dx = enemy.position.x - position.x;
         const dy = enemy.position.y - position.y;
         const distanceSquared = dx * dx + dy * dy;

         if (distanceSquared <= radiusSquared) {
            nearby.push(enemy);
         }
      }

      return nearby;
   }

   /**
    * Inject nearby enemy query method into enemies
    * This allows enemies to query for nearby enemies without direct coupling
    */
   private setupEnemyNearbyQuery(enemy: BaseEnemy): void {
      // Override the getNearbyEnemies method in BaseEnemy
      (enemy as any).getNearbyEnemies = (radius: number = 150): BaseEnemy[] => {
         return this.getNearbyEnemies(enemy.position, radius, enemy.id);
      };
   }
}
