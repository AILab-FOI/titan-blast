// shared/src/game/map-system/ChunkVisibilityUtils.ts

import { ChunkRequest } from '../MapTypes';

export interface ChunkPosition {
   x: number;
   y: number;
}

export interface ChunkVisibilityBounds {
   minX: number;
   maxX: number;
   minY: number;
   maxY: number;
}

/**
 * Shared utility class for calculating chunk visibility
 * Used by both client and server to ensure consistent behavior
 */
export class ChunkVisibilityUtils {
   /**
    * Calculate which chunks are visible from a center position
    * @param centerChunk The center chunk position
    * @param viewDistance The view distance in chunks
    * @param mapBounds Optional map boundaries to clamp results
    * @returns Array of chunk positions that should be visible
    */
   public static getVisibleChunks(
      centerChunk: ChunkPosition,
      viewDistance: number,
      mapBounds?: ChunkVisibilityBounds,
   ): ChunkPosition[] {
      // Always use rectangular with 16:9 aspect ratio
      return this.getRectangularChunks(centerChunk, viewDistance, mapBounds);
   }

   /**
    * Get chunks in a rectangular pattern around the center with 16:9 aspect ratio
    */
   private static getRectangularChunks(
      center: ChunkPosition,
      radius: number,
      mapBounds?: ChunkVisibilityBounds,
   ): ChunkPosition[] {
      const chunks: ChunkPosition[] = [];

      // Apply 16:9 aspect ratio to rectangular loading
      const aspectRatio = 16 / 9;
      const hRadius = Math.ceil(radius * aspectRatio);
      const vRadius = radius;

      // Calculate boundaries
      let minX = center.x - hRadius;
      let maxX = center.x + hRadius;
      let minY = center.y - vRadius;
      let maxY = center.y + vRadius;

      // Apply map bounds if provided
      if (mapBounds) {
         minX = Math.max(mapBounds.minX, minX);
         maxX = Math.min(mapBounds.maxX, maxX);
         minY = Math.max(mapBounds.minY, minY);
         maxY = Math.min(mapBounds.maxY, maxY);
      }

      // Generate chunk positions
      for (let y = minY; y <= maxY; y++) {
         for (let x = minX; x <= maxX; x++) {
            chunks.push({ x, y });
         }
      }

      return chunks;
   }

   /**
    * Check if a specific chunk is within view distance of a center position
    * @param chunkPos The chunk position to check
    * @param centerChunk The center chunk position
    * @param viewDistance The view distance in chunks
    * @returns True if the chunk is within view distance
    */
   public static isChunkInView(chunkPos: ChunkPosition, centerChunk: ChunkPosition, viewDistance: number): boolean {
      // For rectangular view with 16:9 aspect ratio
      const aspectRatio = 16 / 9;
      const hRadius = Math.ceil(viewDistance * aspectRatio);
      const vRadius = viewDistance;

      const dx = Math.abs(chunkPos.x - centerChunk.x);
      const dy = Math.abs(chunkPos.y - centerChunk.y);

      return dx <= hRadius && dy <= vRadius;
   }

   /**
    * Convert chunk requests to chunk positions for easier processing
    */
   public static chunkRequestsToPositions(requests: ChunkRequest[]): ChunkPosition[] {
      return requests.map((req) => ({ x: req.chunkX, y: req.chunkY }));
   }

   /**
    * Convert chunk positions to chunk requests with priority based on distance
    */
   public static chunkPositionsToRequests(positions: ChunkPosition[], centerChunk: ChunkPosition): ChunkRequest[] {
      return positions.map((pos) => ({
         chunkX: pos.x,
         chunkY: pos.y,
         priority: this.calculateChunkPriority(pos, centerChunk),
      }));
   }

   /**
    * Calculate priority for a chunk based on distance from center
    * Lower values = higher priority
    */
   private static calculateChunkPriority(chunkPos: ChunkPosition, centerChunk: ChunkPosition): number {
      const dx = chunkPos.x - centerChunk.x;
      const dy = chunkPos.y - centerChunk.y;
      return Math.abs(dx) + Math.abs(dy); // Manhattan distance for priority
   }

   /**
    * Filter chunk requests to only include those within view distance
    * This is the method that should be used by the server to validate requests
    */
   public static filterValidChunkRequests(
      requests: ChunkRequest[],
      playerChunkPos: ChunkPosition,
      viewDistance: number,
   ): ChunkRequest[] {
      return requests.filter((request) => {
         const chunkPos = { x: request.chunkX, y: request.chunkY };
         return this.isChunkInView(chunkPos, playerChunkPos, viewDistance);
      });
   }
}
