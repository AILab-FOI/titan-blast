// client/src/game/map-system/FrontendMapRenderer.ts

import { Container, Sprite, Texture } from 'pixi.js';
import { MapChunk } from 'shared/game/map-system/MapChunk';
import { gameSettings } from 'shared/game/SystemSettings';
import FrontendGame from '../FrontendGame';
import { Renderable } from '../rendering/Renderable';
import { Tile } from 'shared/game/map-system/MapTypes';

/**
 * Data structure to hold render-related data for a chunk
 */
interface ChunkRenderData {
   chunk: MapChunk;
   container: Container;
   sprites: Map<string, Sprite>;
}

/**
 * Handles rendering of the map on the client side
 */
export class FrontendMapRenderer implements Renderable {
   private game: FrontendGame;
   private mapContainer: Container;
   private loadedChunks: Map<string, ChunkRenderData> = new Map();
   private tileSize: number = 32; // Default Tiled tile size

   constructor(game: FrontendGame, container: Container) {
      this.game = game;
      this.mapContainer = container;
   }

   /**
    * Set the tile size for this map
    */
   public setTileSize(tileSize: number): void {
      this.tileSize = tileSize;
      console.log(`Map renderer tile size set to: ${this.tileSize}px`);
   }

   /**
    * Get texture for a tile ID directly from the asset loader
    */
   private getTextureForTileId(tileId: number): Texture {
      // Handle empty tiles (ID 0)
      if (tileId === 0) {
         return Texture.EMPTY;
      }

      // Get the map sprites from asset loader
      const mapSprites = this.game.getAssets().getMapSprites();

      // Convert Tiled ID to texture name
      // Tiled uses 1-based IDs, but our textures are named 0-based
      // So Tiled ID 1 = texture "0.png", Tiled ID 2 = texture "1.png", etc.
      const textureName = `${tileId}.png`;

      const texture = mapSprites.textures[textureName];

      if (!texture) {
         console.warn(`No texture found for tile ID ${tileId} (looking for ${textureName}), using fallback`);
         return Texture.WHITE; // Visible fallback so you can see missing textures
      }

      return texture;
   }

   /**
    * Add a new chunk to be rendered
    */
   public addChunk(chunk: MapChunk): void {
      const chunkKey = MapChunk.getChunkKey(chunk.chunkX, chunk.chunkY);

      // Skip if this chunk is already loaded
      if (this.loadedChunks.has(chunkKey)) return;

      // Create container for this chunk
      const chunkContainer = new Container();

      // Position the container based on chunk position
      const chunkWorldX = chunk.chunkX * gameSettings.chunkSize * this.tileSize;
      const chunkWorldY = chunk.chunkY * gameSettings.chunkSize * this.tileSize;
      chunkContainer.position.set(chunkWorldX, chunkWorldY);

      // Add the container to the map
      this.mapContainer.addChild(chunkContainer);

      // Render all tiles in the chunk
      const sprites = this.renderChunkTiles(chunk, chunkContainer);

      // Store the chunk render data
      this.loadedChunks.set(chunkKey, {
         chunk,
         container: chunkContainer,
         sprites,
      });
   }

   /**
    * Render all tiles in a chunk
    */
   private renderChunkTiles(chunk: MapChunk, container: Container): Map<string, Sprite> {
      const sprites = new Map<string, Sprite>();
      const tiles = chunk.getAllTiles();

      for (let y = 0; y < gameSettings.chunkSize; y++) {
         for (let x = 0; x < gameSettings.chunkSize; x++) {
            const tile = tiles[y][x];

            // Skip if tile doesn't exist
            if (!tile) continue;

            // Render the tile
            const sprite = this.renderTile(tile, x, y);
            if (sprite) {
               container.addChild(sprite);
               const spriteKey = `${x}_${y}`;
               sprites.set(spriteKey, sprite);
            }
         }
      }

      return sprites;
   }

   /**
    * Render a single tile
    */
   private renderTile(tile: Tile, localX: number, localY: number): Sprite | null {
      // Skip rendering empty tiles
      if (tile.tileId === 0) {
         return null;
      }

      // Get texture directly from asset loader
      const texture = this.getTextureForTileId(tile.tileId);

      const sprite = new Sprite(texture);
      sprite.width = this.tileSize;
      sprite.height = this.tileSize;

      // Position within the chunk
      sprite.position.set(localX * this.tileSize, localY * this.tileSize);

      return sprite;
   }

   /**
    * Remove a chunk from rendering
    */
   public removeChunk(chunkX: number, chunkY: number): void {
      const chunkKey = MapChunk.getChunkKey(chunkX, chunkY);
      const chunkData = this.loadedChunks.get(chunkKey);

      if (!chunkData) return;

      // Remove container from map
      this.mapContainer.removeChild(chunkData.container);

      // Destroy all sprites
      chunkData.sprites.forEach((sprite) => {
         sprite.destroy();
      });

      // Destroy container
      chunkData.container.destroy();

      // Remove from loaded chunks
      this.loadedChunks.delete(chunkKey);
   }

   /**
    * Update a tile's visual appearance
    */
   public updateTile(tileX: number, tileY: number, updates: any): void {
      const chunkX = Math.floor(tileX / gameSettings.chunkSize);
      const chunkY = Math.floor(tileY / gameSettings.chunkSize);
      const chunkKey = MapChunk.getChunkKey(chunkX, chunkY);

      const chunkData = this.loadedChunks.get(chunkKey);
      if (!chunkData) return;

      const localX = tileX % gameSettings.chunkSize;
      const localY = tileY % gameSettings.chunkSize;
      const spriteKey = `${localX}_${localY}`;

      const sprite = chunkData.sprites.get(spriteKey);

      // Update tile ID means changing the texture
      if (updates.tileId !== undefined) {
         if (updates.tileId === 0 && sprite) {
            // Remove sprite if tile is now empty
            chunkData.container.removeChild(sprite);
            sprite.destroy();
            chunkData.sprites.delete(spriteKey);
         } else if (updates.tileId !== 0) {
            const newTexture = this.getTextureForTileId(updates.tileId);

            if (sprite) {
               // Update existing sprite
               sprite.texture = newTexture;
            } else {
               // Create new sprite if it doesn't exist
               const newSprite = new Sprite(newTexture);
               newSprite.width = this.tileSize;
               newSprite.height = this.tileSize;
               newSprite.position.set(localX * this.tileSize, localY * this.tileSize);
               chunkData.container.addChild(newSprite);
               chunkData.sprites.set(spriteKey, newSprite);
            }
         }
      }
   }

   /**
    * Update method for Renderable interface
    */
   public update(): void {
      // Currently no dynamic updates needed
   }

   /**
    * Get all visible chunks
    */
   public getVisibleChunks(): string[] {
      return Array.from(this.loadedChunks.keys());
   }

   /**
    * Check if a chunk is loaded
    */
   public isChunkLoaded(chunkX: number, chunkY: number): boolean {
      const chunkKey = MapChunk.getChunkKey(chunkX, chunkY);
      return this.loadedChunks.has(chunkKey);
   }

   /**
    * Get the current tile size
    */
   public getTileSize(): number {
      return this.tileSize;
   }
}