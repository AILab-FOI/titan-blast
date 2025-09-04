// shared/src/game/map-system/MapChunk.ts

import { Tile, TileType, SerializedMapChunk, SerializedTile } from './MapTypes';
import { gameSettings } from '../SystemSettings';
import { v4 as uuidv4 } from 'uuid';

export class MapChunk {
   public readonly id: string;
   public readonly chunkX: number;
   public readonly chunkY: number;
   private tiles: Tile[][];
   private isDirty: boolean = false;
   private lastModified: number = Date.now();
   public loadedForClients: Set<string> = new Set();

   constructor(chunkX: number, chunkY: number, tiles?: Tile[][]) {
      this.id = uuidv4();
      this.chunkX = chunkX;
      this.chunkY = chunkY;

      if (tiles) {
         this.tiles = tiles;
      } else {
         // Initialize empty tiles array
         this.tiles = new Array(gameSettings.chunkSize);
         for (let y = 0; y < gameSettings.chunkSize; y++) {
            this.tiles[y] = new Array(gameSettings.chunkSize);
         }
      }
   }

   /**
    * Get a tile at the specified local coordinates within the chunk
    */
   public getTile(localX: number, localY: number): Tile | null {
      if (localX < 0 || localX >= gameSettings.chunkSize || localY < 0 || localY >= gameSettings.chunkSize) {
         return null;
      }

      return this.tiles[localY][localX];
   }

   /**
    * Update a tile at the specified local coordinates
    */
   public updateTile(localX: number, localY: number, updates: Partial<Tile>): boolean {
      const tile = this.getTile(localX, localY);
      if (!tile) return false;

      Object.assign(tile, updates);
      this.isDirty = true;
      this.lastModified = Date.now();

      return true;
   }

   /**
    * Mark this chunk as loaded for a specific player
    */
   public loadForPlayer(username: string): void {
      this.loadedForClients.add(username);
   }

   /**
    * Unmark this chunk as loaded for a specific player
    */
   public unloadForPlayer(username: string): void {
      this.loadedForClients.delete(username);
   }

   /**
    * Check if this chunk is loaded for a specific player
    */
   public isLoadedForPlayer(username: string): boolean {
      return this.loadedForClients.has(username);
   }

   /**
    * Check if this chunk is dirty (has been modified)
    */
   public isDirtyChunk(): boolean {
      return this.isDirty;
   }

   /**
    * Mark this chunk as clean (after serialization)
    */
   public markClean(): void {
      this.isDirty = false;
   }

   /**
    * Serialize this chunk for network transmission
    */
   public serialize(): SerializedMapChunk {
      const serializedTiles: SerializedTile[] = [];

      // Flatten and serialize all tiles
      for (let y = 0; y < gameSettings.chunkSize; y++) {
         for (let x = 0; x < gameSettings.chunkSize; x++) {
            const tile = this.tiles[y][x];

            // Only include tiles that exist
            if (tile) {
               serializedTiles.push({
                  x,
                  y,
                  tileId: tile.tileId,
                  walkable: tile.walkable,
               });
            }
         }
      }

      return {
         chunkX: this.chunkX,
         chunkY: this.chunkY,
         tiles: serializedTiles,
         timestamp: this.lastModified,
         version: 1,
      };
   }

   /**
    * Static method to deserialize a chunk from network data
    */
   public static deserialize(serializedChunk: SerializedMapChunk, tileSize: number): MapChunk {
      const chunk = new MapChunk(serializedChunk.chunkX, serializedChunk.chunkY);

      // Create empty tiles grid
      const tiles: Tile[][] = new Array(gameSettings.chunkSize);
      for (let y = 0; y < gameSettings.chunkSize; y++) {
         tiles[y] = new Array(gameSettings.chunkSize);
      }

      // Fill in tiles from serialized data
      if (serializedChunk.tiles && Array.isArray(serializedChunk.tiles)) {
         for (const serializedTile of serializedChunk.tiles) {
            const { x, y, tileId, walkable } = serializedTile;

            // Skip invalid coordinates
            if (x < 0 || x >= gameSettings.chunkSize || y < 0 || y >= gameSettings.chunkSize) {
               continue;
            }

            // Create the tile
            const tile: Tile = {
               tileType: walkable ? TileType.Ground : TileType.Wall,
               position: {
                  x: (chunk.chunkX * gameSettings.chunkSize + x) * tileSize,
                  y: (chunk.chunkY * gameSettings.chunkSize + y) * tileSize,
               },
               walkable,
               tileId,
            };

            tiles[y][x] = tile;
         }
      }

      chunk.tiles = tiles;
      return chunk;
   }

   /**
    * Get all tiles in this chunk
    */
   public getAllTiles(): Tile[][] {
      return this.tiles;
   }

   /**
    * Get chunk key for maps
    */
   public static getChunkKey(x: number, y: number): string {
      return `${x},${y}`;
   }
}
