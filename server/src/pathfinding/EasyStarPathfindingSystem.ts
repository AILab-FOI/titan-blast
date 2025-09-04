// shared/src/game/pathfinding/EasyStarPathfindingSystem.ts

import * as EasyStar from 'easystarjs';
import { Position } from 'shared/game/Position';
import { TileType } from 'shared/game/map-system/MapTypes';
import type * as RAPIER from '@dimforge/rapier2d-compat';
import { MathUtil } from 'shared/util/MathUtil';

export interface Waypoint {
   position: Position;
   isTarget: boolean;
}

export interface PathResult {
   waypoints: Waypoint[];
   found: boolean;
   distance: number;
   targetReached: boolean;
}

export interface PathRequest {
   start: Position;
   target: Position;
   maxDistance?: number;
   allowPartialPath?: boolean;
   enemyWidth: number;
   enemyHeight: number;
}

export class EasyStarPathfindingSystem {
   private easystar: EasyStar.js;
   private world: RAPIER.World;
   private rapier: typeof RAPIER;

   private grid!: number[][];
   private tileSize!: number;
   private mapWidth!: number;
   private mapHeight!: number;
   private mapOffsetX!: number;
   private mapOffsetY!: number;

   private pathCache: Map<string, { result: PathResult; timestamp: number }> = new Map();
   private readonly CACHE_DURATION = 3000;

   constructor(world: RAPIER.World, rapier: typeof RAPIER) {
      this.world = world;
      this.rapier = rapier;
      this.easystar = new EasyStar.js();

      this.easystar.setAcceptableTiles([0]);
      this.easystar.enableDiagonals();
      this.easystar.disableCornerCutting();
   }

   public initialize(
      mapWidth: number,
      mapHeight: number,
      tileSize: number,
      tiles: TileType[][],
      mapOffsetX: number = 0,
      mapOffsetY: number = 0,
   ): void {
      console.log('🏗️ Initializing EasyStar pathfinding system...');

      this.mapWidth = mapWidth;
      this.mapHeight = mapHeight;
      this.tileSize = tileSize;
      this.mapOffsetX = mapOffsetX;
      this.mapOffsetY = mapOffsetY;

      this.grid = this.buildSimpleGrid(tiles);
      this.easystar.setGrid(this.grid);

      // Debug grid info
      const totalTiles = this.grid.length * this.grid[0].length;
      let blockedTiles = 0;
      for (let y = 0; y < this.grid.length; y++) {
         for (let x = 0; x < this.grid[y].length; x++) {
            if (this.grid[y][x] === 1) blockedTiles++;
         }
      }

      // console.log(
      //    `📊 Grid: ${this.grid[0].length}x${this.grid.length}, blocked: ${blockedTiles}/${totalTiles} (${((blockedTiles / totalTiles) * 100).toFixed(1)}%)`,
      // );
   }

   private buildSimpleGrid(tiles: TileType[][]): number[][] {
      const grid: number[][] = [];

      for (let y = 0; y < tiles.length; y++) {
         grid[y] = [];
         for (let x = 0; x < tiles[y].length; x++) {
            grid[y][x] = tiles[y][x] === TileType.Wall ? 1 : 0;
         }
      }

      return grid;
   }

   /**
    * Create an enemy-sized grid with RECTANGULAR safety margin calculation
    */
   private createEnemySizedGrid(enemyWidth: number, enemyHeight: number): number[][] {
      // console.log(`   🔧 Creating enemy-sized grid for dimensions ${enemyWidth}×${enemyHeight}`);

      const enlargedGrid: number[][] = [];

      for (let y = 0; y < this.grid.length; y++) {
         enlargedGrid[y] = [];
         for (let x = 0; x < this.grid[y].length; x++) {
            // Test if an enemy can fit at this grid position
            const canFit = this.canEnemyFitAtGridPosition(x, y, enemyWidth, enemyHeight);
            enlargedGrid[y][x] = canFit ? 0 : 1;
         }
      }

      return enlargedGrid;
   }

   /**
    * Check if an enemy with given dimensions can fit at a specific grid position
    * Uses sub-tile precision checking with rectangular collision detection
    */
   private canEnemyFitAtGridPosition(gridX: number, gridY: number, enemyWidth: number, enemyHeight: number): boolean {
      const centerWorld = this.gridToWorld({ x: gridX, y: gridY });

      const WALL_PADDING = 12;

      const halfWidth = enemyWidth / 2 + WALL_PADDING;
      const halfHeight = enemyHeight / 2 + WALL_PADDING;

      const enemyBounds = {
         left: centerWorld.x - halfWidth,
         right: centerWorld.x + halfWidth,
         top: centerWorld.y - halfHeight,
         bottom: centerWorld.y + halfHeight,
      };

      const samplePoints = [
         // Corners
         { x: enemyBounds.left, y: enemyBounds.top },
         { x: enemyBounds.right, y: enemyBounds.top },
         { x: enemyBounds.left, y: enemyBounds.bottom },
         { x: enemyBounds.right, y: enemyBounds.bottom },
         // Edge midpoints
         { x: centerWorld.x, y: enemyBounds.top },
         { x: centerWorld.x, y: enemyBounds.bottom },
         { x: enemyBounds.left, y: centerWorld.y },
         { x: enemyBounds.right, y: centerWorld.y },
         // Center
         { x: centerWorld.x, y: centerWorld.y },
      ];

      // Check if any sample point is in a blocked tile
      for (const point of samplePoints) {
         if (!this.isWorldPositionWalkable(point)) {
            return false;
         }
      }

      return true;
   }

   /**
    * Check if a specific world position is walkable (sub-tile precision)
    */
   private isWorldPositionWalkable(worldPos: Position): boolean {
      const gridPos = this.worldToGrid(worldPos);

      // Check bounds
      if (!this.isValidGridPosition(gridPos)) {
         return false;
      }

      // Check if the tile at this position is blocked
      return this.grid[gridPos.y][gridPos.x] === 0;
   }

   /**
    * Find nearest valid position when start/target is blocked
    */
   private findNearestValidPosition(
      gridPos: { x: number; y: number },
      grid: number[][],
   ): {
      x: number;
      y: number;
   } | null {
      // Search in expanding circles for a valid position
      for (let radius = 1; radius <= 3; radius++) {
         for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
               if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

               const checkX = gridPos.x + dx;
               const checkY = gridPos.y + dy;

               if (checkY >= 0 && checkY < grid.length && checkX >= 0 && checkX < grid[0].length) {
                  if (grid[checkY][checkX] === 0) {
                     return { x: checkX, y: checkY };
                  }
               }
            }
         }
      }
      return null;
   }

   public async findPath(request: PathRequest): Promise<PathResult> {
      // console.log(
      //    `🗺️ ASYNC PATHFINDING: (${request.start.x.toFixed(1)}, ${request.start.y.toFixed(1)}) -> (${request.target.x.toFixed(1)}, ${request.target.y.toFixed(1)}), dimensions: ${request.enemyWidth}×${request.enemyHeight}`,
      // );

      const cacheKey = `${request.start.x.toFixed(0)},${request.start.y.toFixed(0)}-${request.target.x.toFixed(0)},${request.target.y.toFixed(0)}-${request.enemyWidth}x${request.enemyHeight}`;

      // Check cache
      const cached = this.pathCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
         // console.log(`   📱 Using cached result`);
         return cached.result;
      }

      // Convert world positions to grid coordinates
      let startGrid = this.worldToGrid(request.start);
      let targetGrid = this.worldToGrid(request.target);

      // console.log(`   🌍 Grid conversion: (${startGrid.x}, ${startGrid.y}) -> (${targetGrid.x}, ${targetGrid.y})`);

      // Validate grid positions
      if (!this.isValidGridPosition(startGrid) || !this.isValidGridPosition(targetGrid)) {
         // console.log(`   ❌ Invalid grid positions`);
         return { waypoints: [], found: false, distance: 0, targetReached: false };
      }

      // Use enemy-sized grid
      const gridToUse = this.createEnemySizedGrid(request.enemyWidth, request.enemyHeight);

      // Handle blocked positions by finding nearby valid ones
      let startBlocked = gridToUse[startGrid.y][startGrid.x] === 1;
      let targetBlocked = gridToUse[targetGrid.y][targetGrid.x] === 1;

      // console.log(`   🚧 Position check: start blocked=${startBlocked}, target blocked=${targetBlocked}`);

      // If start is blocked, find nearest valid position
      if (startBlocked) {
         const nearStart = this.findNearestValidPosition(startGrid, gridToUse);
         if (nearStart) {
            // console.log(
            //    `   🔄 Found valid start position: (${startGrid.x}, ${startGrid.y}) -> (${nearStart.x}, ${nearStart.y})`,
            // );
            startGrid = nearStart;
            startBlocked = false;
         }
      }

      // If target is blocked, find nearest valid position
      if (targetBlocked) {
         const nearTarget = this.findNearestValidPosition(targetGrid, gridToUse);
         if (nearTarget) {
            // console.log(
            //    `   🔄 Found valid target position: (${targetGrid.x}, ${targetGrid.y}) -> (${nearTarget.x}, ${nearTarget.y})`,
            // );
            targetGrid = nearTarget;
            targetBlocked = false;
         }
      }

      // If still blocked after trying to find alternatives
      if (startBlocked || targetBlocked) {
         // console.warn(`   ⚠️ Could not find valid positions - start: ${startBlocked}, target: ${targetBlocked}`);
         return { waypoints: [], found: false, distance: 0, targetReached: false };
      }

      // Set the grid for pathfinding
      this.easystar.setGrid(gridToUse);

      return new Promise((resolve) => {
         this.easystar.findPath(startGrid.x, startGrid.y, targetGrid.x, targetGrid.y, (path) => {
            // Reset to normal grid after pathfinding
            this.easystar.setGrid(this.grid);

            // console.log(`   📊 EasyStar result: ${path ? `${path.length} path points` : 'No path'}`);

            if (path === null) {
               const result = { waypoints: [], found: false, distance: 0, targetReached: false };
               this.pathCache.set(cacheKey, { result, timestamp: Date.now() });
               resolve(result);
               return;
            }

            // Convert grid path to world positions
            const worldPath = path.map((point) => this.gridToWorld({ x: point.x, y: point.y }));

            // Create waypoints with path smoothing
            const waypoints = this.createWaypoints(worldPath, request.target);

            // console.log(`   ✅ Created ${waypoints.length} waypoints`);

            const result: PathResult = {
               waypoints,
               found: true,
               distance: this.calculatePathDistance(worldPath),
               targetReached: true,
            };

            // Cache result
            this.pathCache.set(cacheKey, { result, timestamp: Date.now() });
            resolve(result);
         });

         // Calculate the path
         this.easystar.calculate();
      });
   }

   private worldToGrid(worldPos: Position): { x: number; y: number } {
      const gridX = Math.floor((worldPos.x - this.mapOffsetX) / this.tileSize);
      const gridY = Math.floor((worldPos.y - this.mapOffsetY) / this.tileSize);
      return { x: gridX, y: gridY };
   }

   private gridToWorld(gridPos: { x: number; y: number }): Position {
      const worldX = gridPos.x * this.tileSize + this.tileSize / 2 + this.mapOffsetX;
      const worldY = gridPos.y * this.tileSize + this.tileSize / 2 + this.mapOffsetY;
      return { x: worldX, y: worldY };
   }

   private isValidGridPosition(gridPos: { x: number; y: number }): boolean {
      return gridPos.x >= 0 && gridPos.x < this.grid[0].length && gridPos.y >= 0 && gridPos.y < this.grid.length;
   }

   private createWaypoints(worldPath: Position[], finalTarget: Position): Waypoint[] {
      if (worldPath.length === 0) return [];

      const waypoints: Waypoint[] = [];

      // Add significant direction changes as waypoints
      for (let i = 0; i < worldPath.length; i++) {
         const isLast = i === worldPath.length - 1;
         const isFirst = i === 0;

         if (isFirst || isLast) {
            waypoints.push({
               position: isLast ? finalTarget : worldPath[i],
               isTarget: isLast,
            });
         } else {
            // Check if this is a significant direction change
            const prev = worldPath[i - 1];
            const curr = worldPath[i];
            const next = worldPath[i + 1];

            const dir1 = { x: curr.x - prev.x, y: curr.y - prev.y };
            const dir2 = { x: next.x - curr.x, y: next.y - curr.y };

            // Normalize directions
            const len1 = Math.sqrt(dir1.x * dir1.x + dir1.y * dir1.y);
            const len2 = Math.sqrt(dir2.x * dir2.x + dir2.y * dir2.y);

            if (len1 > 0 && len2 > 0) {
               dir1.x /= len1;
               dir1.y /= len1;
               dir2.x /= len2;
               dir2.y /= len2;

               const dot = dir1.x * dir2.x + dir1.y * dir2.y;

               if (dot < 0.866) {
                  waypoints.push({
                     position: curr,
                     isTarget: false,
                  });
               }
            }
         }
      }

      return waypoints;
   }

   private calculatePathDistance(path: Position[]): number {
      if (path.length < 2) return 0;

      let distance = 0;
      for (let i = 1; i < path.length; i++) {
         distance += MathUtil.distance(path[i - 1], path[i]);
      }

      return distance;
   }

   public hasLineOfSight(from: Position, to: Position): boolean {
      const startGrid = this.worldToGrid(from);
      const endGrid = this.worldToGrid(to);

      const dx = Math.abs(endGrid.x - startGrid.x);
      const dy = Math.abs(endGrid.y - startGrid.y);
      const sx = startGrid.x < endGrid.x ? 1 : -1;
      const sy = startGrid.y < endGrid.y ? 1 : -1;
      let err = dx - dy;

      let currentX = startGrid.x;
      let currentY = startGrid.y;

      while (true) {
         if (
            currentX < 0 ||
            currentX >= this.grid[0].length ||
            currentY < 0 ||
            currentY >= this.grid.length ||
            this.grid[currentY][currentX] === 1
         ) {
            return false;
         }

         if (currentX === endGrid.x && currentY === endGrid.y) {
            return true;
         }

         const e2 = 2 * err;
         if (e2 > -dy) {
            err -= dy;
            currentX += sx;
         }
         if (e2 < dx) {
            err += dx;
            currentY += sy;
         }
      }
   }

   public getAvoidanceDirection(
      position: Position,
      intendedDirection: Position,
      avoidanceStrength: number = 0.7,
   ): Position {
      return intendedDirection;
   }

   public clearCache(): void {
      this.pathCache.clear();
   }
}
