// server/src/pathfinding/PathfindingManager.ts
// Updated to use ONLY async pathfinding with proper promise handling

import { Position } from 'shared/game/Position';
import type * as RAPIER from '@dimforge/rapier2d-compat';
import { BackendMapSystem } from '../map-system/BackendMapSystem';
import { EasyStarPathfindingSystem, Waypoint } from './EasyStarPathfindingSystem';
import { TileType } from 'shared/game/map-system/MapTypes';
import { MathUtil } from 'shared/util/MathUtil';
import { IPathfindingService } from 'shared/game/enemies/interfaces/IPathfindingService';

/**
 * Enemy pathfinding state for server tracking
 */
interface EnemyPathState {
   enemyId: string;
   currentWaypoints: Waypoint[];
   lastTarget: Position | null;
   lastUpdate: number;
   needsPathRecalculation: boolean;
   currentWaypointIndex: number;
   enemyWidth: number;
   enemyHeight: number;
   isCalculatingPath: boolean;
   pendingPathRequest: {
      start: Position;
      target: Position;
      timestamp: number;
   } | null;
}

export interface PathfindingUpdate {
   enemyId: string;
   waypoints: Waypoint[];
   timestamp: number;
}

/**
 * Server-side pathfinding manager using ONLY async pathfinding
 * Removes problematic sync pathfinding and handles async properly
 */
export class PathfindingManager implements IPathfindingService {
   private pathfindingSystem: EasyStarPathfindingSystem;
   private enemyPaths: Map<string, EnemyPathState> = new Map();

   // Update configuration
   private readonly WAYPOINT_UPDATE_INTERVAL = 500; // 500ms
   private readonly PATH_RECALC_DISTANCE = 100; // Recalculate if target moves >100px
   private readonly WAYPOINT_THRESHOLD = 30; // Consider waypoint reached if within 30px
   private readonly MAX_PENDING_TIME = 2000; // Max 2s for a pathfinding request

   constructor(world: RAPIER.World, rapier: typeof RAPIER) {
      this.pathfindingSystem = new EasyStarPathfindingSystem(world, rapier);
   }

   /**
    * Initialize pathfinding with map data
    */
   public initialize(mapSystem: BackendMapSystem): void {
      console.log('🏗️ Initializing async pathfinding manager...');

      const worldMap = mapSystem.getWorldMap();
      if (!worldMap) {
         console.error('❌ Cannot initialize pathfinding: no world map available');
         return;
      }

      const dimensions = worldMap.getDimensions();
      const tileSize = worldMap.getTileSize();
      const mapWidth = dimensions.width * tileSize;
      const mapHeight = dimensions.height * tileSize;

      console.log(`📊 Map: ${dimensions.width}x${dimensions.height} tiles, ${mapWidth}x${mapHeight} pixels`);

      // Build tile data array from WorldMap
      const tiles: TileType[][] = [];
      for (let y = 0; y < dimensions.height; y++) {
         tiles[y] = [];
         for (let x = 0; x < dimensions.width; x++) {
            const tile = worldMap.getTileAtTileCoord(x, y);
            if (tile) {
               tiles[y][x] = tile.tileType;
            } else {
               tiles[y][x] = TileType.Ground;
            }
         }
      }

      this.pathfindingSystem.initialize(mapWidth, mapHeight, tileSize, tiles, 0, 0);
      console.log(`✅ Async pathfinding manager initialized`);
   }

   /**
    * Request pathfinding for an enemy - NOW FULLY ASYNC
    * Returns immediately with current path, triggers async recalculation if needed
    */
   public requestPath(
      enemyId: string,
      currentPosition: Position,
      targetPosition: Position,
      enemyWidth: number,
      enemyHeight: number,
   ): Position | null {
      const shortId = enemyId.substring(0, 8);
      const now = Date.now();

      // console.log(
      //    `🔍 [${shortId}] Async pathfinding request: (${currentPosition.x.toFixed(1)}, ${currentPosition.y.toFixed(1)}) -> (${targetPosition.x.toFixed(1)}, ${targetPosition.y.toFixed(1)})`,
      // );

      let pathState = this.enemyPaths.get(enemyId);

      // Initialize path state if doesn't exist
      if (!pathState) {
         // console.log(`   🆕 [${shortId}] Creating new path state`);
         pathState = {
            enemyId,
            currentWaypoints: [],
            lastTarget: null,
            lastUpdate: 0,
            needsPathRecalculation: false,
            currentWaypointIndex: 0,
            enemyWidth,
            enemyHeight,
            isCalculatingPath: false,
            pendingPathRequest: null,
         };
         this.enemyPaths.set(enemyId, pathState);
      }

      pathState.enemyWidth = enemyWidth;
      pathState.enemyHeight = enemyHeight;

      // Check if we need to recalculate path
      const needsRecalc = this.shouldRecalculatePath(pathState, targetPosition, now);

      // console.log(
      //    `   📊 [${shortId}] Path state: waypoints=${pathState.currentWaypoints.length}, index=${pathState.currentWaypointIndex}, calculating=${pathState.isCalculatingPath}, needsRecalc=${needsRecalc}`,
      // );

      // Start async pathfinding if needed and not already calculating
      if (needsRecalc && !pathState.isCalculatingPath) {
         // console.log(`   🚀 [${shortId}] Starting async path calculation`);
         this.startAsyncPathCalculation(pathState, currentPosition, targetPosition);
      }

      // Clean up old pending requests
      this.cleanupOldRequests(pathState, now);

      // Get next waypoint from current path (immediate return)
      const nextWaypoint = this.getNextWaypoint(pathState, currentPosition);

      if (!nextWaypoint) {
         // console.log(`   ❌ [${shortId}] No waypoint available (calculating: ${pathState.isCalculatingPath})`);

         // If we're calculating, provide a temporary direct movement target for close targets
         if (pathState.isCalculatingPath) {
            const distance = MathUtil.distance(currentPosition, targetPosition);
            if (distance < 150) {
               // console.log(
               //    `   🎯 [${shortId}] Using temporary direct target while calculating (distance: ${distance.toFixed(1)})`,
               // );
               return targetPosition;
            }
         }

         return null;
      }

      // console.log(`   ✅ [${shortId}] Next waypoint: (${nextWaypoint.x.toFixed(1)}, ${nextWaypoint.y.toFixed(1)})`);

      // Apply local obstacle avoidance
      const avoidanceDirection = {
         x: nextWaypoint.x - currentPosition.x,
         y: nextWaypoint.y - currentPosition.y,
      };

      const adjustedDirection = this.pathfindingSystem.getAvoidanceDirection(currentPosition, avoidanceDirection, 0.3);

      const finalTarget = {
         x: currentPosition.x + adjustedDirection.x,
         y: currentPosition.y + adjustedDirection.y,
      };

      return finalTarget;
   }

   private async startAsyncPathCalculation(
      pathState: EnemyPathState,
      currentPosition: Position,
      targetPosition: Position,
   ): Promise<void> {
      const shortId = pathState.enemyId.substring(0, 8);

      pathState.isCalculatingPath = true;
      pathState.pendingPathRequest = {
         start: { ...currentPosition },
         target: { ...targetPosition },
         timestamp: Date.now(),
      };

      // console.log(`   🔄 [${shortId}] Async pathfinding started`);

      try {
         const pathResult = await this.pathfindingSystem.findPath({
            start: currentPosition,
            target: targetPosition,
            allowPartialPath: true,
            enemyWidth: pathState.enemyWidth,
            enemyHeight: pathState.enemyHeight,
         });

         // Check if this result is still relevant
         const pendingRequest = pathState.pendingPathRequest;
         if (
            !pendingRequest ||
            MathUtil.distance(pendingRequest.start, currentPosition) > 50 ||
            MathUtil.distance(pendingRequest.target, targetPosition) > 50
         ) {
            // console.log(`   ⚠️ [${shortId}] Pathfinding result obsolete, discarding`);
            return;
         }

         if (pathResult.found && pathResult.waypoints.length > 0) {
            pathState.currentWaypoints = [...pathResult.waypoints];
            pathState.lastTarget = { ...targetPosition };
            pathState.lastUpdate = Date.now();
            pathState.needsPathRecalculation = false;
            pathState.currentWaypointIndex = 0;

            // console.log(`   ✅ [${shortId}] Async path calculated: ${pathState.currentWaypoints.length} waypoints`);

            // Log waypoints for debugging
            pathState.currentWaypoints.forEach((wp, i) => {
               // console.log(
               //    `      Waypoint ${i}: (${wp.position.x.toFixed(1)}, ${wp.position.y.toFixed(1)}) ${wp.isTarget ? '[TARGET]' : ''}`,
               // );
            });
         } else {
            // console.warn(`   ❌ [${shortId}] Async pathfinding failed - no path found`);
            pathState.currentWaypoints = [];
            pathState.needsPathRecalculation = true;
            pathState.currentWaypointIndex = 0;
         }
      } catch (error) {
         // console.error(`   💥 [${shortId}] Async pathfinding error:`, error);
         pathState.needsPathRecalculation = true;
         pathState.currentWaypoints = [];
      } finally {
         pathState.isCalculatingPath = false;
         pathState.pendingPathRequest = null;
      }
   }

   /**
    * Get next waypoint from the current path
    */
   private getNextWaypoint(pathState: EnemyPathState, currentPosition: Position): Position | null {
      if (pathState.currentWaypoints.length === 0) {
         return null;
      }

      // Check if we need to advance to the next waypoint
      while (pathState.currentWaypointIndex < pathState.currentWaypoints.length) {
         const currentWaypoint = pathState.currentWaypoints[pathState.currentWaypointIndex];
         const distanceToWaypoint = MathUtil.distance(currentPosition, currentWaypoint.position);

         // If close enough to current waypoint, advance to next
         if (distanceToWaypoint <= this.WAYPOINT_THRESHOLD) {
            // console.log(
            //    `   ➡️ [${pathState.enemyId.substring(0, 8)}] Reached waypoint ${pathState.currentWaypointIndex}, advancing`,
            // );
            pathState.currentWaypointIndex++;
            continue;
         }

         return currentWaypoint.position;
      }

      // console.log(`   🏁 [${pathState.enemyId.substring(0, 8)}] Reached end of path`);
      return null;
   }

   /**
    * Check if path needs recalculation
    */
   private shouldRecalculatePath(pathState: EnemyPathState, newTarget: Position, currentTime: number): boolean {
      // Force recalculation if flagged
      if (pathState.needsPathRecalculation) {
         return true;
      }

      // No previous target - need initial calculation
      if (!pathState.lastTarget) {
         return true;
      }

      // Target moved significantly
      const targetMoved = MathUtil.distance(pathState.lastTarget, newTarget) > this.PATH_RECALC_DISTANCE;
      if (targetMoved) {
         return true;
      }

      // Periodic recalculation for long paths
      const timeSinceUpdate = currentTime - pathState.lastUpdate;
      if (timeSinceUpdate > this.WAYPOINT_UPDATE_INTERVAL * 4) {
         return true;
      }

      // No waypoints left or reached end of path
      if (
         pathState.currentWaypoints.length === 0 ||
         pathState.currentWaypointIndex >= pathState.currentWaypoints.length
      ) {
         return true;
      }

      return false;
   }

   /**
    * Clean up old pending requests that are taking too long
    */
   private cleanupOldRequests(pathState: EnemyPathState, currentTime: number): void {
      if (
         pathState.pendingPathRequest &&
         currentTime - pathState.pendingPathRequest.timestamp > this.MAX_PENDING_TIME
      ) {
         // console.log(`   🧹 [${pathState.enemyId.substring(0, 8)}] Cleaning up old pending request`);
         pathState.isCalculatingPath = false;
         pathState.pendingPathRequest = null;
         pathState.needsPathRecalculation = true;
      }
   }

   public getPathfindingUpdates(): PathfindingUpdate[] {
      const updates: PathfindingUpdate[] = [];
      const now = Date.now();

      for (const pathState of this.enemyPaths.values()) {
         if (now - pathState.lastUpdate >= this.WAYPOINT_UPDATE_INTERVAL && pathState.currentWaypoints.length > 0) {
            updates.push({
               enemyId: pathState.enemyId,
               waypoints: [...pathState.currentWaypoints],
               timestamp: now,
            });

            pathState.lastUpdate = now;
         }
      }

      return updates;
   }

   public invalidateEnemyPath(enemyId: string): void {
      const pathState = this.enemyPaths.get(enemyId);
      if (pathState) {
         pathState.needsPathRecalculation = true;
      }
   }

   public removeEnemy(enemyId: string): void {
      this.enemyPaths.delete(enemyId);
   }

   public hasLineOfSight(from: Position, to: Position): boolean {
      return this.pathfindingSystem.hasLineOfSight(from, to);
   }

   public getEnemyWaypoints(enemyId: string): Waypoint[] {
      const pathState = this.enemyPaths.get(enemyId);
      return pathState ? pathState.currentWaypoints : [];
   }

   public getStats(): any {
      let calculating = 0;
      for (const pathState of this.enemyPaths.values()) {
         if (pathState.isCalculatingPath) calculating++;
      }

      return {
         trackedEnemies: this.enemyPaths.size,
         calculatingPaths: calculating,
         avgWaypoints: this.getAverageWaypoints(),
      };
   }

   private getAverageWaypoints(): number {
      if (this.enemyPaths.size === 0) return 0;

      let totalWaypoints = 0;
      for (const pathState of this.enemyPaths.values()) {
         totalWaypoints += pathState.currentWaypoints.length;
      }

      return totalWaypoints / this.enemyPaths.size;
   }

   public clearCache(): void {
      this.enemyPaths.clear();
   }
}
