// server/src/enemies/EnemySpawner.ts

import type * as RAPIER from '@dimforge/rapier2d-compat';
import { Position } from 'shared/game/Position';
import { EnemySpawnConfig, EnemyType } from 'shared/game/enemies/EnemyInterfaces';
import { BackendMapSystem } from '../map-system/BackendMapSystem';
import { PlayerManager } from '../PlayerManager';
import { BackendPlayer } from '../BackendPlayer';

/**
 * Configuration for spawn validation and behavior
 */
export interface SpawnValidationConfig {
   /** Minimum distance from players to spawn enemies */
   minPlayerDistance: number;

   /** Maximum distance from players to spawn enemies */
   maxPlayerDistance: number;

   /** Number of attempts to find a valid spawn position */
   maxSpawnAttempts: number;

   /** Minimum distance between spawned enemies */
   minEnemySpacing: number;

   /** Whether to use player view field for spawn validation */
   respectPlayerViewField: boolean;
}

/**
 * Information about a spawn area with additional validation data
 */
export interface ValidatedSpawnArea {
   center: Position;
   radius: number;
   allowedTypes: EnemyType[];
   isValid: boolean;
   validationErrors: string[];
}

/**
 * Result of a spawn attempt
 */
export interface SpawnAttemptResult {
   success: boolean;
   position?: Position;
   reason?: string;
   attempts: number;
}

/**
 * Advanced enemy spawning system with comprehensive validation
 *
 * This class handles:
 * - Map boundary validation
 * - Collision detection with solid objects
 * - Player view field avoidance
 * - Enemy spacing management
 * - Performance optimization
 */
export class EnemySpawner {
   private world: RAPIER.World;
   private rapier: typeof RAPIER;
   private mapSystem: BackendMapSystem;
   private playerManager: PlayerManager;

   private config: SpawnValidationConfig;

   // Cache for performance optimization
   private lastValidationTime: number = 0;
   private validatedAreas: Map<string, ValidatedSpawnArea> = new Map();
   private colliderCache: Map<string, RAPIER.Collider[]> = new Map();

   // Spawned enemy positions for spacing validation
   private recentSpawnPositions: Array<{ position: Position; timestamp: number }> = [];
   private readonly SPAWN_POSITION_CLEANUP_INTERVAL = 30000; // 30 seconds

   constructor(
      world: RAPIER.World,
      rapier: typeof RAPIER,
      mapSystem: BackendMapSystem,
      playerManager: PlayerManager,
      config?: Partial<SpawnValidationConfig>,
   ) {
      this.world = world;
      this.rapier = rapier;
      this.mapSystem = mapSystem;
      this.playerManager = playerManager;

      // Default configuration
      this.config = {
         minPlayerDistance: 200,
         maxPlayerDistance: 1500,
         maxSpawnAttempts: 50,
         minEnemySpacing: 30,
         respectPlayerViewField: true,
         ...config,
      };

      setInterval(() => this.cleanupOldSpawnPositions(), this.SPAWN_POSITION_CLEANUP_INTERVAL);
   }

   /**
    * Update spawner configuration
    */
   public updateConfig(newConfig: Partial<SpawnValidationConfig>): void {
      this.config = { ...this.config, ...newConfig };

      // Clear caches when config changes
      this.validatedAreas.clear();
      this.colliderCache.clear();
   }

   /**
    * Get current spawner configuration
    */
   public getConfig(): SpawnValidationConfig {
      return { ...this.config };
   }

   /**
    * Generate validated spawn configurations
    *
    * @param spawnAreas Available spawn areas
    * @param count Number of enemies to spawn
    * @param difficultyMultiplier Current difficulty level
    * @returns Array of valid spawn configurations
    */
   public generateValidatedSpawnConfigs(
      spawnAreas: Array<{
         center: Position;
         radius: number;
         allowedTypes: EnemyType[];
      }>,
      count: number,
      difficultyMultiplier: number = 1.0,
   ): EnemySpawnConfig[] {
      const configs: EnemySpawnConfig[] = [];
      const playersMap = this.playerManager.getPlayers();
      const players = Array.from(playersMap.values());

      if (players.length === 0) {
         console.warn('No players found, cannot generate spawn configurations');
         return configs;
      }

      // Validate spawn areas first
      const validatedAreas = this.validateSpawnAreas(spawnAreas);
      const validAreas = validatedAreas.filter((area) => area.isValid);

      if (validAreas.length === 0) {
         console.warn('No valid spawn areas found');
         return configs;
      }

      for (let i = 0; i < count; i++) {
         const spawnResult = this.findValidSpawnPosition(validAreas, players);

         if (spawnResult.success && spawnResult.position) {
            // Select random spawn area for enemy type selection
            const randomArea = validAreas[Math.floor(Math.random() * validAreas.length)];
            const enemyType = randomArea.allowedTypes[Math.floor(Math.random() * randomArea.allowedTypes.length)];

            // Determine level based on difficulty
            const level = Math.max(1, Math.floor(difficultyMultiplier));

            configs.push({
               enemyType,
               position: spawnResult.position,
               level,
            });

            // Track this spawn position for spacing validation
            this.recentSpawnPositions.push({
               position: spawnResult.position,
               timestamp: Date.now(),
            });

            // console.log(
            //    `✅ Generated valid spawn config for ${enemyType} at (${spawnResult.position.x.toFixed(1)}, ${spawnResult.position.y.toFixed(1)}) after ${spawnResult.attempts} attempts`,
            // );
         } else {
            // console.warn(`❌ Failed to find valid spawn position: ${spawnResult.reason}`);
         }
      }

      return configs;
   }

   /**
    * Validate spawn areas for basic requirements
    */
   private validateSpawnAreas(
      spawnAreas: Array<{
         center: Position;
         radius: number;
         allowedTypes: EnemyType[];
      }>,
   ): ValidatedSpawnArea[] {
      return spawnAreas.map((area) => {
         const errors: string[] = [];
         let isValid = true;

         // Check if center is within map bounds
         if (!this.isPositionWithinMapBounds(area.center)) {
            errors.push('Spawn area center is outside map bounds');
            isValid = false;
         }

         // Check if area has valid enemy types
         if (!area.allowedTypes || area.allowedTypes.length === 0) {
            errors.push('No allowed enemy types specified');
            isValid = false;
         }

         // Check if radius is reasonable
         if (area.radius <= 0) {
            errors.push('Invalid spawn area radius');
            isValid = false;
         }

         return {
            ...area,
            isValid,
            validationErrors: errors,
         };
      });
   }

   /**
    * Find a valid spawn position considering all constraints
    */
   private findValidSpawnPosition(validAreas: ValidatedSpawnArea[], players: BackendPlayer[]): SpawnAttemptResult {
      for (let attempt = 0; attempt < this.config.maxSpawnAttempts; attempt++) {
         // Select random spawn area
         const area = validAreas[Math.floor(Math.random() * validAreas.length)];

         // Generate random position within area
         const angle = Math.random() * Math.PI * 2;
         const distance = Math.random() * area.radius;
         const position: Position = {
            x: area.center.x + Math.cos(angle) * distance,
            y: area.center.y + Math.sin(angle) * distance,
         };

         // Run all validation checks
         const validationResult = this.validateSpawnPosition(position, players);

         if (validationResult.isValid) {
            return {
               success: true,
               position,
               attempts: attempt + 1,
            };
         }
      }

      return {
         success: false,
         reason: `Failed to find valid position after ${this.config.maxSpawnAttempts} attempts`,
         attempts: this.config.maxSpawnAttempts,
      };
   }

   /**
    * Comprehensive validation of a spawn position
    */
   private validateSpawnPosition(
      position: Position,
      players: BackendPlayer[],
   ): {
      isValid: boolean;
      reasons: string[];
   } {
      const reasons: string[] = [];

      // 1. Check map boundaries
      if (!this.isPositionWithinMapBounds(position)) {
         reasons.push('Position outside map bounds');
      }

      // 2. Check if position is walkable (not inside walls/solid objects)
      if (!this.isPositionWalkable(position)) {
         reasons.push('Position not walkable (inside solid object)');
      }

      // 3. Check distance from players
      const playerDistanceCheck = this.validatePlayerDistance(position, players);
      if (!playerDistanceCheck.isValid) {
         reasons.push(...playerDistanceCheck.reasons);
      }

      // 4. Check player view field if enabled
      if (this.config.respectPlayerViewField) {
         const viewFieldCheck = this.validatePlayerViewField(position, players);
         if (!viewFieldCheck.isValid) {
            reasons.push(...viewFieldCheck.reasons);
         }
      }

      // 5. Check spacing from other recently spawned enemies
      if (!this.validateEnemySpacing(position)) {
         reasons.push('Too close to recently spawned enemy');
      }

      return {
         isValid: reasons.length === 0,
         reasons,
      };
   }

   /**
    * Check if position is within map boundaries with safety margin
    */
   private isPositionWithinMapBounds(position: Position): boolean {
      const worldMap = this.mapSystem.getWorldMap();
      const dimensions = worldMap.getDimensions();
      const tileSize = worldMap.getTileSize();

      const mapWidth = dimensions.width * tileSize;
      const mapHeight = dimensions.height * tileSize;

      return position.x >= 0 && position.x <= mapWidth && position.y >= 0 && position.y <= mapHeight;
   }

   /**
    * Check if position is walkable (not inside walls or solid objects)
    */
   private isPositionWalkable(position: Position): boolean {
      // Check with map system first
      const worldMap = this.mapSystem.getWorldMap();
      if (!worldMap.isWalkable(position.x, position.y)) {
         return false;
      }

      return this.isPositionClearOfColliders(position);
   }

   /**
    * Check if position is clear of physics colliders
    */
   private isPositionClearOfColliders(position: Position): boolean {
      // Create a small test shape at the position
      const testRadius = 15; // Small radius to test for overlap

      // Query for intersecting colliders
      const point = new this.rapier.Vector2(position.x, position.y);
      const intersections: boolean[] = [];

      this.world.intersectionsWithPoint(point, (collider) => {
         // Ignore sensor colliders (they don't block movement)
         if (!collider.isSensor()) {
            intersections.push(true);
         }
         return true;
      });

      return intersections.length === 0;
   }

   /**
    * Validate distance constraints relative to players
    */
   private validatePlayerDistance(
      position: Position,
      players: BackendPlayer[],
   ): {
      isValid: boolean;
      reasons: string[];
   } {
      const reasons: string[] = [];

      for (const player of players) {
         const distance = this.calculateDistance(position, player.position);

         if (distance < this.config.minPlayerDistance) {
            reasons.push(`Too close to player (${distance.toFixed(1)} < ${this.config.minPlayerDistance})`);
         }

         if (distance > this.config.maxPlayerDistance) {
            reasons.push(`Too far from player (${distance.toFixed(1)} > ${this.config.maxPlayerDistance})`);
         }
      }

      return {
         isValid: reasons.length === 0,
         reasons,
      };
   }

   /**
    * Check if position is outside player view fields
    */
   private validatePlayerViewField(
      position: Position,
      players: BackendPlayer[],
   ): {
      isValid: boolean;
      reasons: string[];
   } {
      const reasons: string[] = [];

      for (const player of players) {
         const distance = this.calculateDistance(position, player.position);

         const playerViewFieldRadius = player.viewDistance;

         if (distance <= playerViewFieldRadius) {
            reasons.push(`Inside player view field (${distance.toFixed(1)} <= ${playerViewFieldRadius})`);
         }
      }

      return {
         isValid: reasons.length === 0,
         reasons,
      };
   }

   /**
    * Check spacing from recently spawned enemies
    */
   private validateEnemySpacing(position: Position): boolean {
      for (const spawnInfo of this.recentSpawnPositions) {
         const distance = this.calculateDistance(position, spawnInfo.position);
         if (distance < this.config.minEnemySpacing) {
            return false;
         }
      }
      return true;
   }

   /**
    * Calculate Euclidean distance between two positions
    */
   private calculateDistance(pos1: Position, pos2: Position): number {
      const dx = pos1.x - pos2.x;
      const dy = pos1.y - pos2.y;
      return Math.sqrt(dx * dx + dy * dy);
   }

   /**
    * Clean up old spawn positions to prevent memory buildup
    */
   private cleanupOldSpawnPositions(): void {
      const currentTime = Date.now();
      const cutoffTime = currentTime - this.SPAWN_POSITION_CLEANUP_INTERVAL;

      this.recentSpawnPositions = this.recentSpawnPositions.filter((spawn) => spawn.timestamp > cutoffTime);
   }

   /**
    * Get debug information about spawn validation
    */
   public getDebugInfo(): {
      config: SpawnValidationConfig;
      recentSpawns: number;
      cacheStats: {
         validatedAreas: number;
         colliderCache: number;
      };
   } {
      return {
         config: this.config,
         recentSpawns: this.recentSpawnPositions.length,
         cacheStats: {
            validatedAreas: this.validatedAreas.size,
            colliderCache: this.colliderCache.size,
         },
      };
   }

   /**
    * Force clear all caches (useful for testing or major map changes)
    */
   public clearCaches(): void {
      this.validatedAreas.clear();
      this.colliderCache.clear();
      this.recentSpawnPositions = [];
   }

   /**
    * Test if a specific position would be valid for spawning
    * Useful for debugging and testing
    */
   public testSpawnPosition(position: Position): {
      isValid: boolean;
      reasons: string[];
      details: {
         withinBounds: boolean;
         walkable: boolean;
         playerDistance: boolean;
         viewField: boolean;
         enemySpacing: boolean;
      };
   } {
      const playersMap = this.playerManager.getPlayers();
      const players = Array.from(playersMap.values());
      const validation = this.validateSpawnPosition(position, players);

      return {
         isValid: validation.isValid,
         reasons: validation.reasons,
         details: {
            withinBounds: this.isPositionWithinMapBounds(position),
            walkable: this.isPositionWalkable(position),
            playerDistance: this.validatePlayerDistance(position, players).isValid,
            viewField: this.config.respectPlayerViewField
               ? this.validatePlayerViewField(position, players).isValid
               : true,
            enemySpacing: this.validateEnemySpacing(position),
         },
      };
   }
}
