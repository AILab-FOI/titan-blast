// client/src/game/map-system/ClientChunkManager.ts

import { MapChunk } from 'shared/game/map-system/MapChunk';
import { ChunkRequest, MapLayer, MapMetadata, SerializedMapChunk, TileType } from 'shared/game/map-system/MapTypes';
import { ServerBound } from 'shared/game/network/SocketEvents';
import { gameSettings } from 'shared/game/SystemSettings';
import FrontendGame from '../FrontendGame';
import { FrontendMapRenderer } from './FrontendMapRenderer';
import * as RAPIER from '@dimforge/rapier2d-compat';
import { MapPhysicsElement } from 'shared/game/map-system/MapPhysicsElement';
import { LRUCache } from 'shared/game/map-system/util/LRUCache';
import { calculateUnloadDistanceInChunks, calculateViewDistanceInChunks } from 'shared/util/Utils';
import { ChunkVisibilityBounds, ChunkVisibilityUtils } from 'shared/game/map-system/util/ChunkVisibilityUtils';

/**
 * Client-side chunk manager that handles loading/unloading chunks
 * and synchronizing with the server
 */
export class ClientChunkManager {
   private game: FrontendGame;

   private mapRenderer: FrontendMapRenderer;

   // Physics world for map elements
   private physicsWorld: RAPIER.World;
   private rapier: typeof RAPIER;

   // Map metadata from server
   private mapMetadata: MapMetadata | null = null;
   private tileSize: number = 32;

   private mapBounds: ChunkVisibilityBounds | null = null;

   // Physics elements for each chunk
   private chunkPhysicsElements: Map<string, MapPhysicsElement[]> = new Map();

   // Cache for chunks to reduce network requests
   private chunkCache: LRUCache<string, SerializedMapChunk>;

   private pendingRequests: Set<string> = new Set();

   private lastPlayerChunkX: number = -999;
   private lastPlayerChunkY: number = -999;

   // Maximum concurrent chunk requests
   private maxConcurrentRequests: number = 3;

   // Track when we last requested chunks to avoid spam
   private lastChunkRequestTime: number = 0;
   private minChunkRequestInterval: number = 500; // Minimum 100ms between chunk requests

   private activelySentRequests: Set<string> = new Set();

   private chunkRequestTimeouts: Map<string, NodeJS.Timeout> = new Map();
   private readonly CHUNK_REQUEST_TIMEOUT = 2000; // 2 seconds
   private readonly WAIT_BEFORE_REQUESTING_AFTER_MOVE = 500;

   /**
    * Create a new client chunk manager
    *
    * @param game Reference to the game instance
    * @param physicsWorld Physics world for map elements
    * @param rapier RAPIER module
    */
   constructor(game: FrontendGame, physicsWorld: RAPIER.World, rapier: typeof RAPIER) {
      this.game = game;
      this.physicsWorld = physicsWorld;
      this.rapier = rapier;

      // Create map renderer
      this.mapRenderer = new FrontendMapRenderer(game, game.getRenderManager().mapContainer);

      // Create chunk cache
      this.chunkCache = new LRUCache<string, SerializedMapChunk>(100);
   }

   /**
    * Set map metadata received from server
    */
   public setMapMetadata(metadata: MapMetadata): void {
      this.mapMetadata = metadata;
      this.tileSize = metadata.tileWidth;

      // Calculate chunk boundaries
      const maxChunkX = Math.ceil(metadata.width / gameSettings.chunkSize) - 1;
      const maxChunkY = Math.ceil(metadata.height / gameSettings.chunkSize) - 1;

      this.mapBounds = {
         minX: 0,
         maxX: maxChunkX,
         minY: 0,
         maxY: maxChunkY,
      };

      // Update renderer with correct tile size
      this.mapRenderer.setTileSize(this.tileSize);

      console.log(
         `Map metadata set: ${metadata.mapName} (${metadata.width}x${metadata.height} tiles, ${this.tileSize}px tile size)`,
      );
      console.log(`Chunk boundaries: (0,0) to (${maxChunkX},${maxChunkY})`);
   }

   /**
    * Check if chunk coordinates are within map boundaries
    */
   private isChunkValid(chunkX: number, chunkY: number): boolean {
      if (!this.mapBounds) return false;
      return (
         chunkX >= this.mapBounds.minX &&
         chunkX <= this.mapBounds.maxX &&
         chunkY >= this.mapBounds.minY &&
         chunkY <= this.mapBounds.maxY
      );
   }

   /**
    * Handle chunk updates from server
    */
   public handleChunkUpdates(chunkDataArray: SerializedMapChunk[] | SerializedMapChunk): void {
      const chunksArray = Array.isArray(chunkDataArray) ? chunkDataArray : [chunkDataArray];

      const isFirstChunkBatch = this.pendingRequests.size === 0 && this.mapRenderer.getVisibleChunks().length === 0;

      for (const chunkData of chunksArray) {
         const { chunkX, chunkY } = chunkData;
         const chunkKey = MapChunk.getChunkKey(chunkX, chunkY);

         this.chunkCache.set(chunkKey, chunkData);

         this.pendingRequests.delete(chunkKey);
         this.activelySentRequests.delete(chunkKey);

         // Clear timeout for this chunk
         const timeout = this.chunkRequestTimeouts.get(chunkKey);
         if (timeout) {
            clearTimeout(timeout);
            this.chunkRequestTimeouts.delete(chunkKey);
         }

         // Process and render the chunk
         this.processChunkData(chunkData);
      }

      // Process next pending requests now that we've received some chunks
      this.processNextPendingRequests();

      // If this was our first batch of chunks, trigger an immediate render
      if (isFirstChunkBatch && chunksArray.length > 0) {
         console.log('Received first chunk batch, triggering initial render');
         this.game.getRenderManager().renderOnce();
      }
   }

   /**
    * Handle tile updates from server
    */
   public handleTileUpdates(updateData: any): void {
      const { chunkKey, tileUpdates } = updateData;

      // Skip if no tile updates
      if (!tileUpdates || !tileUpdates.length) return;

      // Apply each tile update
      for (const update of tileUpdates) {
         this.updateTile(update.tileX, update.tileY, update.updates);
      }
   }

   /**
    * Update a tile with new data
    */
   public updateTile(tileX: number, tileY: number, updates: any): void {
      // Update the visual representation
      this.mapRenderer.updateTile(tileX, tileY, updates);

      // Update physics if needed (e.g., tile type changed)
      if (updates.tileType !== undefined || updates.walkable !== undefined) {
         this.updateTilePhysics(tileX, tileY, updates);
      }
   }

   /**
    * Process and render a chunk
    */
   private processChunkData(chunkData: SerializedMapChunk): void {
      // Deserialize the chunk
      const chunk = MapChunk.deserialize(chunkData, this.tileSize);

      // Create physics elements for the chunk
      this.createPhysicsForChunk(chunk);

      // Render the chunk
      this.mapRenderer.addChunk(chunk);
   }

   /**
    * Create physics bodies for a chunk
    */
   private createPhysicsForChunk(chunk: MapChunk): void {
      const chunkKey = MapChunk.getChunkKey(chunk.chunkX, chunk.chunkY);

      // Skip if physics already exists for this chunk
      if (this.chunkPhysicsElements.has(chunkKey)) return;

      const physicsElements: MapPhysicsElement[] = [];
      const tiles = chunk.getAllTiles();

      // Create physics bodies for non-walkable tiles
      for (let y = 0; y < gameSettings.chunkSize; y++) {
         for (let x = 0; x < gameSettings.chunkSize; x++) {
            const tile = tiles[y][x];

            // Skip if tile doesn't exist or is walkable
            if (!tile || tile.walkable) continue;

            // Create physics element
            const physicsElement = new MapPhysicsElement(
               this.physicsWorld,
               this.rapier,
               tile.tileType,
               tile.position,
               MapLayer.Walls,
               this.tileSize,
            );

            physicsElement.spawn(tile.position, 0);

            physicsElements.push(physicsElement);
         }
      }

      // Store the physics elements for this chunk
      this.chunkPhysicsElements.set(chunkKey, physicsElements);
   }

   /**
    * Remove physics bodies for a chunk
    */
   private removePhysicsForChunk(chunkX: number, chunkY: number): void {
      const chunkKey = MapChunk.getChunkKey(chunkX, chunkY);
      const physicsElements = this.chunkPhysicsElements.get(chunkKey);

      if (!physicsElements) return;

      for (const element of physicsElements) {
         element.despawn();
      }

      this.chunkPhysicsElements.delete(chunkKey);
   }

   /**
    * Update physics for a tile
    */
   private updateTilePhysics(tileX: number, tileY: number, updates: any): void {
      const chunkX = Math.floor(tileX / gameSettings.chunkSize);
      const chunkY = Math.floor(tileY / gameSettings.chunkSize);
      const chunkKey = MapChunk.getChunkKey(chunkX, chunkY);

      const physicsElements = this.chunkPhysicsElements.get(chunkKey) || [];

      const worldX = tileX * this.tileSize;
      const worldY = tileY * this.tileSize;

      const existingElement = physicsElements.find((element) => {
         const pos = element.getPosition();
         return pos.x === worldX && pos.y === worldY;
      });

      // Handle different cases based on walkability
      if (updates.walkable === false) {
         // If tile is now non-walkable but didn't have physics, create it
         if (!existingElement) {
            const newElement = new MapPhysicsElement(
               this.physicsWorld,
               this.rapier,
               updates.tileType || TileType.Wall,
               { x: worldX, y: worldY },
               MapLayer.Walls,
               this.tileSize,
            );

            newElement.spawn({ x: worldX, y: worldY }, 0);

            physicsElements.push(newElement);
            this.chunkPhysicsElements.set(chunkKey, physicsElements);
         }
      } else if (updates.walkable === true && existingElement) {
         // If tile is now walkable but had physics before, remove it
         existingElement.despawn();

         const newElements = physicsElements.filter((element) => element !== existingElement);
         this.chunkPhysicsElements.set(chunkKey, physicsElements);
      }
   }

   /**
    * Update chunks based on player position
    *
    * @param playerX Player X position in world coordinates
    * @param playerY Player Y position in world coordinates
    */
   public updateChunksAroundPlayer(playerX: number, playerY: number): void {
      // Don't proceed if we don't have map metadata yet
      if (!this.mapMetadata || !this.mapBounds) {
         return;
      }

      // Convert player position to chunk coordinates
      const playerChunkX = Math.floor(playerX / (gameSettings.chunkSize * this.tileSize));
      const playerChunkY = Math.floor(playerY / (gameSettings.chunkSize * this.tileSize));

      // Check if we should throttle chunk requests
      const currentTime = Date.now();
      const shouldRequestChunks = currentTime - this.lastChunkRequestTime > this.minChunkRequestInterval;

      // Skip if player hasn't moved to a new chunk and we're not due for a chunk request
      if (playerChunkX === this.lastPlayerChunkX && playerChunkY === this.lastPlayerChunkY && !shouldRequestChunks) {
         return;
      }

      this.lastPlayerChunkX = playerChunkX;
      this.lastPlayerChunkY = playerChunkY;

      const viewDistance = calculateViewDistanceInChunks(this.tileSize);

      // Use shared utility to get chunks to load
      const centerChunk = { x: playerChunkX, y: playerChunkY };
      const visibleChunkPositions = ChunkVisibilityUtils.getVisibleChunks(centerChunk, viewDistance, this.mapBounds);

      // Filter out chunks that are already loaded or being requested
      const chunksToLoad: ChunkRequest[] = [];
      for (const chunkPos of visibleChunkPositions) {
         const chunkKey = MapChunk.getChunkKey(chunkPos.x, chunkPos.y);

         // Skip if chunk is already loaded or being requested
         if (this.mapRenderer.isChunkLoaded(chunkPos.x, chunkPos.y) || this.pendingRequests.has(chunkKey)) {
            continue;
         }

         // Check if in cache first
         const cachedChunk = this.chunkCache.get(chunkKey);
         if (cachedChunk) {
            this.processChunkData(cachedChunk);
            continue;
         }

         const dx = Math.abs(chunkPos.x - playerChunkX);
         const dy = Math.abs(chunkPos.y - playerChunkY);
         const actualDistance = Math.max(dx, dy);

         // Only request chunks that are well within view distance (with small safety margin)
         if (actualDistance > viewDistance - 1) {
            continue;
         }

         // Calculate priority based on distance from center
         const priority = Math.abs(chunkPos.x - playerChunkX) + Math.abs(chunkPos.y - playerChunkY);
         console.log('addding chunk to load: ', chunkPos, priority);

         chunksToLoad.push({
            chunkX: chunkPos.x,
            chunkY: chunkPos.y,
            priority,
         });
      }

      // Unload distant chunks
      const unloadDistance = calculateUnloadDistanceInChunks(this.tileSize);
      this.unloadDistantChunks(playerChunkX, playerChunkY, unloadDistance);

      // Request new chunks from server - but only if we actually need them
      if (chunksToLoad.length > 0) {
         const timeSinceLastMove = currentTime - this.lastChunkRequestTime;
         if (timeSinceLastMove < this.WAIT_BEFORE_REQUESTING_AFTER_MOVE) {
            return;
         }

         this.requestChunks(chunksToLoad);
         this.lastChunkRequestTime = currentTime;
      }
   }

   /**
    * Unload chunks that are too far from the player
    */
   private unloadDistantChunks(centerX: number, centerY: number, maxDistance: number): void {
      const loadedChunks = this.mapRenderer.getVisibleChunks();

      for (const chunkKey of loadedChunks) {
         const [x, y] = chunkKey.split(',').map(Number);

         // Use shared utility to check if chunk should be unloaded
         const chunkPos = { x, y };
         const centerChunk = { x: centerX, y: centerY };
         const isInView = ChunkVisibilityUtils.isChunkInView(chunkPos, centerChunk, maxDistance);

         if (!isInView) {
            // console.log(`Unloading distant chunk (${x}, ${y})`);
            this.removePhysicsForChunk(x, y);
            this.mapRenderer.removeChunk(x, y);
         }
      }
   }

   /**
    * Request chunks from server
    */
   private requestChunks(chunksToLoad: ChunkRequest[]): void {
      // Filter out invalid chunks before sorting and processing
      const validChunks = chunksToLoad.filter((chunk) => this.isChunkValid(chunk.chunkX, chunk.chunkY));

      if (validChunks.length === 0) {
         return;
      }

      validChunks.sort((a, b) => a.priority - b.priority);

      // Add chunks to pending requests
      for (const chunk of validChunks) {
         const chunkKey = MapChunk.getChunkKey(chunk.chunkX, chunk.chunkY);
         this.pendingRequests.add(chunkKey);
      }

      console.log(
         `Added ${validChunks.length} chunks to pending requests. Total pending: ${this.pendingRequests.size}`,
      );

      this.processNextPendingRequests();
   }

   /**
    * Process the next batch of pending requests
    */
   private processNextPendingRequests(): void {
      // Clean up completed requests first
      for (const chunkKey of this.activelySentRequests) {
         const [x, y] = chunkKey.split(',').map(Number);
         if (this.mapRenderer.isChunkLoaded(x, y)) {
            this.activelySentRequests.delete(chunkKey);
            this.pendingRequests.delete(chunkKey);

            // Clear timeout for this chunk
            const timeout = this.chunkRequestTimeouts.get(chunkKey);
            if (timeout) {
               clearTimeout(timeout);
               this.chunkRequestTimeouts.delete(chunkKey);
            }
         }
      }

      // Calculate how many more requests we can make
      const availableSlots = Math.max(0, this.maxConcurrentRequests - this.activelySentRequests.size);

      if (availableSlots <= 0) {
         console.log(
            `No available slots for chunk requests. Active: ${this.activelySentRequests.size}, Max: ${this.maxConcurrentRequests}`,
         );
         return;
      }

      // Get the next pending requests to process
      const chunksToRequest: ChunkRequest[] = [];

      // Collect up to availableSlots requests from pending that aren't actively sent
      let count = 0;
      for (const chunkKey of this.pendingRequests) {
         if (count >= availableSlots) break;

         // Skip if we've already sent a request for this chunk
         if (this.activelySentRequests.has(chunkKey)) {
            continue;
         }

         const [x, y] = chunkKey.split(',').map(Number);

         // Skip if already loaded
         if (this.mapRenderer.isChunkLoaded(x, y)) {
            this.pendingRequests.delete(chunkKey);
            continue;
         }

         // Double-check that chunk coordinates are valid before requesting
         if (!this.isChunkValid(x, y)) {
            console.warn(`Attempting to request invalid chunk (${x}, ${y}), removing from pending`);
            this.pendingRequests.delete(chunkKey);
            continue;
         }

         // Add to request batch
         chunksToRequest.push({
            chunkX: x,
            chunkY: y,
            priority: 0,
         });

         // Mark as actively sent
         this.activelySentRequests.add(chunkKey);

         // Set timeout for this chunk request
         const timeout = setTimeout(() => {
            console.log(`⏰ Chunk request timed out for (${x}, ${y}), freeing up slot for new requests`);

            // Remove from both active requests AND pending requests
            // This allows the client to request more important chunks based on current position
            this.activelySentRequests.delete(chunkKey);
            this.pendingRequests.delete(chunkKey);
            this.chunkRequestTimeouts.delete(chunkKey);

            // Try to process more requests (will be based on current player position)
            this.processNextPendingRequests();
         }, this.CHUNK_REQUEST_TIMEOUT);

         this.chunkRequestTimeouts.set(chunkKey, timeout);
         count++;
      }

      // Send request to server if we have chunks to request
      if (chunksToRequest.length > 0) {
         console.log(
            `Requesting ${chunksToRequest.length} chunks from server:`,
            chunksToRequest.map((c) => `(${c.chunkX},${c.chunkY})`),
            `Active requests: ${this.activelySentRequests.size}/${this.maxConcurrentRequests}`,
         );
         this.game.getClientTransport().broadcast(ServerBound.RequestChunks, chunksToRequest);
      }
   }

   /**
    * Get the map renderer
    */
   public getMapRenderer(): FrontendMapRenderer {
      return this.mapRenderer;
   }

   public getTileSize(): number {
      return this.tileSize;
   }
}
