// shared/src/game/map-system/WorldMap.ts

import { MapChunk } from './MapChunk';
import { MapMetadata, Tile, TileType } from './MapTypes';
import { gameSettings } from '../SystemSettings';
import { MapDefinition } from './MapDefinition';

/**
 * Represents a fixed-size world map made of chunks
 */
export class WorldMap {
   /** Map of chunks by their coordinates */
   private chunks: Map<string, MapChunk> = new Map();

   /** Complete tile grid for the entire map */
   private tileGrid: Tile[][];

   /** Map definition */
   private mapDef: MapDefinition;

   /** Map dimensions */
   private readonly width: number;
   private readonly height: number;

   /** Tile size */
   private readonly tileSize: number;

   /** Chunk dimensions */
   private readonly chunksWide: number;
   private readonly chunksHigh: number;

   constructor(mapDef: MapDefinition) {
      this.mapDef = mapDef;
      this.width = mapDef.width;
      this.height = mapDef.height;
      this.tileSize = mapDef.tileWidth;

      // Calculate how many chunks we need
      this.chunksWide = Math.ceil(this.width / gameSettings.chunkSize);
      this.chunksHigh = Math.ceil(this.height / gameSettings.chunkSize);

      // Generate the complete tile grid from Tiled data
      this.tileGrid = this.generateTileGrid();

      console.log(
         `Created fixed map: ${mapDef.name} (${this.width}x${this.height} tiles, ` +
            `${this.chunksWide}x${this.chunksHigh} chunks, ${this.tileSize}px tiles)`,
      );
   }

   /**
    * Generate the tile grid from Tiled layer data
    */
   private generateTileGrid(): Tile[][] {
      const grid: Tile[][] = [];
      console.log('generating tile grid:');
      console.log(this.height, this.width);
      for (let y = 0; y < this.height; y++) {
         grid[y] = [];
         for (let x = 0; x < this.width; x++) {
            const index = y * this.width + x;

            // Get tile IDs from layers
            const groundTileId = this.mapDef.groundLayerData[index] || 0;
            const wallTileId = this.mapDef.wallsLayerData[index] || 0;

            // Determine tile properties
            // If there's a wall tile, it takes precedence
            const isWall = wallTileId !== 0;
            const tileId = isWall ? wallTileId : groundTileId;

            grid[y][x] = {
               tileType: isWall ? TileType.Wall : TileType.Ground,
               position: {
                  x: x * this.tileSize,
                  y: y * this.tileSize,
               },
               walkable: !isWall,
               tileId: tileId,
            };
         }
      }

      return grid;
   }

   /**
    * Get the tile size for this map
    */
   public getTileSize(): number {
      return this.tileSize;
   }

   /**
    * Get a chunk at the specified coordinates, creating it if needed
    */
   public getChunk(chunkX: number, chunkY: number): MapChunk | null {
      // Check if the coordinates are out of bounds
      if (chunkX < 0 || chunkX >= this.chunksWide || chunkY < 0 || chunkY >= this.chunksHigh) {
         return null;
      }

      // Try to get the chunk from the cache
      const chunkKey = MapChunk.getChunkKey(chunkX, chunkY);
      let chunk = this.chunks.get(chunkKey);

      // If chunk doesn't exist, extract it from the tile grid
      if (!chunk) {
         chunk = this.createChunkFromTileGrid(chunkX, chunkY);
         this.chunks.set(chunkKey, chunk);
      }

      return chunk;
   }

   /**
    * Create a new chunk from the tile grid
    */
   private createChunkFromTileGrid(chunkX: number, chunkY: number): MapChunk {
      const startX = chunkX * gameSettings.chunkSize;
      const startY = chunkY * gameSettings.chunkSize;

      const chunkTiles: Tile[][] = [];

      for (let localY = 0; localY < gameSettings.chunkSize; localY++) {
         chunkTiles[localY] = [];

         for (let localX = 0; localX < gameSettings.chunkSize; localX++) {
            const worldX = startX + localX;
            const worldY = startY + localY;

            // Check if this position is within the map bounds
            if (worldX < this.width && worldY < this.height) {
               // Deep copy the tile from the grid
               const sourceTile = this.tileGrid[worldY][worldX];
               chunkTiles[localY][localX] = {
                  ...sourceTile,
                  position: { ...sourceTile.position },
               };
            } else {
               // For out of bounds, create an empty non-walkable tile
               chunkTiles[localY][localX] = {
                  tileType: TileType.Ground,
                  position: {
                     x: (chunkX * gameSettings.chunkSize + localX) * this.tileSize,
                     y: (chunkY * gameSettings.chunkSize + localY) * this.tileSize,
                  },
                  walkable: true,
                  tileId: 0,
               };
            }
         }
      }

      return new MapChunk(chunkX, chunkY, chunkTiles);
   }

   /**
    * Get a tile at the specified world coordinates
    */
   public getTileAtWorldCoord(worldX: number, worldY: number): Tile | null {
      const tileX = Math.floor(worldX / this.tileSize);
      const tileY = Math.floor(worldY / this.tileSize);
      return this.getTileAtTileCoord(tileX, tileY);
   }

   /**
    * Get a tile at the specified tile coordinates
    */
   public getTileAtTileCoord(tileX: number, tileY: number): Tile | null {
      if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
         return null;
      }
      return this.tileGrid[tileY][tileX];
   }

   /**
    * Update a tile at the specified tile coordinates
    */
   public updateTileAtTileCoord(tileX: number, tileY: number, updates: Partial<Tile>): boolean {
      if (tileX < 0 || tileX >= this.width || tileY < 0 || tileY >= this.height) {
         return false;
      }

      // Update the tile in the grid
      Object.assign(this.tileGrid[tileY][tileX], updates);

      // Mark the corresponding chunk as dirty
      const chunkX = Math.floor(tileX / gameSettings.chunkSize);
      const chunkY = Math.floor(tileY / gameSettings.chunkSize);
      const chunkKey = MapChunk.getChunkKey(chunkX, chunkY);

      const chunk = this.chunks.get(chunkKey);
      if (chunk) {
         const localX = tileX % gameSettings.chunkSize;
         const localY = tileY % gameSettings.chunkSize;
         chunk.updateTile(localX, localY, updates);
      }

      return true;
   }

   /**
    * Check if a position is walkable
    */
   public isWalkable(worldX: number, worldY: number): boolean {
      const tile = this.getTileAtWorldCoord(worldX, worldY);
      if (!tile) return false;
      return tile.walkable;
   }

   /**
    * Get the map dimensions
    */
   public getDimensions(): { width: number; height: number } {
      return { width: this.width, height: this.height };
   }

   /**
    * Get the map chunk dimensions
    */
   public getChunkDimensions(): { width: number; height: number } {
      return { width: this.chunksWide, height: this.chunksHigh };
   }

   /**
    * Get the map definition
    */
   public getMapDefinition(): MapDefinition {
      return this.mapDef;
   }

   /**
    * Get map metadata
    */
   public getMetadata(): MapMetadata {
      return {
         mapId: this.mapDef.id,
         mapName: this.mapDef.name,
         width: this.width,
         height: this.height,
         tileWidth: this.tileSize,
         tileHeight: this.tileSize,
      };
   }
}
