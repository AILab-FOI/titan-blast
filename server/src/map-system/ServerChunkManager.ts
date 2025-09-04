// server/src/map-system/ServerChunkManager.ts
import { MapChunk } from 'shared/game/map-system/MapChunk';
import { ChunkRequest, MapLayer, SerializedMapChunk, TileType } from 'shared/game/map-system/MapTypes';
import { ClientBound } from 'shared/game/network/SocketEvents';
import { gameSettings } from 'shared/game/SystemSettings';
import { ServerGeckosTransport } from '../network/ServerGeckosTransport';
import { BackendPlayer } from '../BackendPlayer';
import { PlayerManager } from '../PlayerManager';
import { WorldMap } from 'shared/game/map-system/WorldMap';
import * as RAPIER from '@dimforge/rapier2d-compat';
import { MapPhysicsElement } from 'shared/game/map-system/MapPhysicsElement';
import { TaskPriority } from 'shared/util/TaskScheduler';
import { calculateViewDistanceInChunks } from 'shared/util/Utils';
import { ChunkVisibilityUtils } from 'shared/game/map-system/util/ChunkVisibilityUtils';
import { BackendGame } from '../BackendGame';

/**
 * Handles chunk-related data for a specific player
 */
interface PlayerChunkData {
   subscriptions: Set<string>;
   lastChunkX: number;
   lastChunkY: number;
}

/**
 * Server-side chunk manager that handles distributing chunks to clients
 * Responsibilities:
 * - Track which chunks each player needs
 * - Send chunk data to players when they move
 * - Manage physics bodies for loaded chunks
 * - Handle tile updates and distribute them to relevant players
 */
export class ServerChunkManager {
   private readonly worldMap: WorldMap;
   private readonly physicsWorld: RAPIER.World;
   private readonly rapier: typeof RAPIER;
   private readonly serverTransport: ServerGeckosTransport;
   private readonly playerManager: PlayerManager;
   private readonly physicsManager: any;
   private readonly tileSize: number;
   private readonly game: BackendGame;

   private readonly playerChunkData = new Map<string, PlayerChunkData>();
   private readonly chunkSubscribers = new Map<string, Set<string>>();

   private readonly chunkPhysicsElements = new Map<string, Map<string, MapPhysicsElement>>();

   private readonly chunkUpdatesBuffer = new Map<string, Map<string, any>>();

   constructor(
      worldMap: WorldMap,
      physicsWorld: RAPIER.World,
      rapier: typeof RAPIER,
      serverTransport: ServerGeckosTransport,
      playerManager: PlayerManager,
      physicsManager: any,
      game: BackendGame,
   ) {
      this.worldMap = worldMap;
      this.physicsWorld = physicsWorld;
      this.rapier = rapier;
      this.serverTransport = serverTransport;
      this.playerManager = playerManager;
      this.physicsManager = physicsManager;
      this.tileSize = worldMap.getTileSize();
      this.game = game;
   }


   /**
    * Initialize the chunk manager and start background tasks
    */
   public initialize(): void {
      console.log(`ServerChunkManager initialized with tile size: ${this.tileSize}px`);
      this.scheduleBufferedUpdates();
   }

   /**
    * Handle player movement and update their chunk subscriptions
    */
   public handlePlayerMove(player: BackendPlayer, positionX: number, positionY: number): void {
      const playerChunkPos = this.worldToChunkCoords(positionX, positionY);
      const playerData = this.getOrCreatePlayerData(player.username);

      if (playerChunkPos.x === playerData.lastChunkX && playerChunkPos.y === playerData.lastChunkY) {
         return;
      }

      // console.log(`Player ${player.username} moved to chunk (${playerChunkPos.x}, ${playerChunkPos.y})`);

      this.updatePlayerChunkSubscriptions(player.username, playerChunkPos);

      playerData.lastChunkX = playerChunkPos.x;
      playerData.lastChunkY = playerChunkPos.y;
   }

   /**
    * Handle explicit chunk requests from clients (fallback system)
    */
   public handleChunkRequests(username: string, requests: ChunkRequest[]): void {
      const player = this.playerManager.getPlayerByUsername(username);
      if (!player) {
         console.warn(`Chunk request from unknown player: ${username}`);
         return;
      }

      const validChunks = this.filterValidChunkRequests(player, requests);
      if (validChunks.length > 0) {
         this.addChunksToPlayer(username, validChunks);
         this.sendChunksToPlayer(username, validChunks);
      }
   }

   /**
    * Update a tile and buffer the change for network distribution
    */
   public updateTile(tileX: number, tileY: number, updates: any): void {
      if (!this.worldMap.updateTileAtTileCoord(tileX, tileY, updates)) {
         return;
      }

      this.updateTilePhysics(tileX, tileY, updates);
      this.bufferTileUpdate(tileX, tileY, updates);
   }

   /**
    * Handle player disconnection
    */
   public handlePlayerDisconnect(username: string): void {
      const playerData = this.playerChunkData.get(username);
      if (!playerData) return;

      // Remove player from all chunk subscribers
      for (const chunkKey of playerData.subscriptions) {
         this.removePlayerFromChunk(username, chunkKey);
      }

      // Clean up player data
      this.playerChunkData.delete(username);
   }

   /**
    * Clean up all resources
    */
   public cleanup(): void {
      // Despawn all physics elements
      for (const physicsElements of this.chunkPhysicsElements.values()) {
         for (const element of physicsElements.values()) {
            element.despawn();
         }
      }

      // Clear all data structures
      this.chunkPhysicsElements.clear();
      this.chunkSubscribers.clear();
      this.playerChunkData.clear();
      this.chunkUpdatesBuffer.clear();
   }

   public getWorldMap(): WorldMap {
      return this.worldMap;
   }


   /**
    * Set up the buffered updates system using the physics loop
    */
   private scheduleBufferedUpdates(): void {
      this.physicsManager.scheduleRepeatingTask(
         () => this.sendBufferedUpdates(),
         gameSettings.syncIntervalTicks,
         0,
         TaskPriority.NORMAL,
      );
      console.log(`Scheduled buffered updates every ${gameSettings.syncIntervalTicks} ticks`);
   }

   /**
    * Get or create player chunk tracking data
    */
   private getOrCreatePlayerData(username: string): PlayerChunkData {
      let playerData = this.playerChunkData.get(username);
      if (!playerData) {
         playerData = {
            subscriptions: new Set(),
            lastChunkX: -999,
            lastChunkY: -999,
         };
         this.playerChunkData.set(username, playerData);
      }
      return playerData;
   }

   /**
    * Convert world coordinates to chunk coordinates
    */
   private worldToChunkCoords(worldX: number, worldY: number): { x: number; y: number } {
      return {
         x: Math.floor(worldX / (gameSettings.chunkSize * this.tileSize)),
         y: Math.floor(worldY / (gameSettings.chunkSize * this.tileSize)),
      };
   }

   /**
    * Update a player's chunk subscriptions based on their position
    */
   /**
    * Update the updatePlayerChunkSubscriptions method to use stored viewport dimensions
    */
   private updatePlayerChunkSubscriptions(username: string, playerChunkPos: { x: number; y: number }): void {
      const viewDistance = calculateViewDistanceInChunks(this.tileSize);

      const chunksInView = ChunkVisibilityUtils.getVisibleChunks(playerChunkPos, viewDistance, {
         minX: 0,
         maxX: this.worldMap.getChunkDimensions().width - 1,
         minY: 0,
         maxY: this.worldMap.getChunkDimensions().height - 1,
      });

      const playerData = this.getOrCreatePlayerData(username);
      const { toAdd, toRemove } = this.calculateChunkChanges(playerData.subscriptions, chunksInView);

      // console.log(`Player ${username}: +${toAdd.length} chunks, -${toRemove.length} chunks`);

      this.removeChunksFromPlayer(username, toRemove);
      this.addChunksToPlayer(username, toAdd);

      // Send new chunks
      if (toAdd.length > 0) {
         this.sendChunksToPlayer(username, toAdd);
      }
   }

   /**
    * Calculate which chunks to add and remove for a player
    */
   private calculateChunkChanges(
      currentSubscriptions: Set<string>,
      chunksInView: { x: number; y: number }[],
   ): { toAdd: { x: number; y: number }[]; toRemove: { x: number; y: number }[] } {
      const toAdd: { x: number; y: number }[] = [];
      const toRemove: { x: number; y: number }[] = [];

      // Find chunks to add
      for (const chunk of chunksInView) {
         const chunkKey = MapChunk.getChunkKey(chunk.x, chunk.y);
         if (!currentSubscriptions.has(chunkKey)) {
            toAdd.push(chunk);
         }
      }

      // Find chunks to remove
      for (const chunkKey of currentSubscriptions) {
         const [x, y] = chunkKey.split(',').map(Number);
         const isInView = chunksInView.some((chunk) => chunk.x === x && chunk.y === y);
         if (!isInView) {
            toRemove.push({ x, y });
         }
      }

      return { toAdd, toRemove };
   }

   /**
    * Add chunks to a player's subscription list
    */
   private addChunksToPlayer(username: string, chunks: { x: number; y: number }[]): void {
      const playerData = this.getOrCreatePlayerData(username);

      for (const chunk of chunks) {
         const chunkKey = MapChunk.getChunkKey(chunk.x, chunk.y);

         playerData.subscriptions.add(chunkKey);

         this.addPlayerToChunk(username, chunkKey);

         this.ensureChunkPhysics(chunk.x, chunk.y);
      }
   }

   /**
    * Remove chunks from a player's subscription list
    */
   private removeChunksFromPlayer(username: string, chunks: { x: number; y: number }[]): void {
      const playerData = this.playerChunkData.get(username);
      if (!playerData) return;

      for (const chunk of chunks) {
         const chunkKey = MapChunk.getChunkKey(chunk.x, chunk.y);

         playerData.subscriptions.delete(chunkKey);

         this.removePlayerFromChunk(username, chunkKey);
      }
   }

   /**
    * Add a player to a chunk's subscriber list
    */
   private addPlayerToChunk(username: string, chunkKey: string): void {
      let subscribers = this.chunkSubscribers.get(chunkKey);
      if (!subscribers) {
         subscribers = new Set();
         this.chunkSubscribers.set(chunkKey, subscribers);
      }
      subscribers.add(username);
   }

   /**
    * Remove a player from a chunk's subscriber list
    */
   private removePlayerFromChunk(username: string, chunkKey: string): void {
      const subscribers = this.chunkSubscribers.get(chunkKey);
      if (subscribers) {
         subscribers.delete(username);

         // If no more subscribers, clean up the chunk
         if (subscribers.size === 0) {
            this.chunkSubscribers.delete(chunkKey);
            const [x, y] = chunkKey.split(',').map(Number);
            this.removeChunkPhysics(x, y);
         }
      }
   }

   /**
    * Send chunk data to a player
    */
   /**
    * Send chunk data to a player
    */
   private sendChunksToPlayer(username: string, chunks: { x: number; y: number }[]): void {
      // console.log(`🔍 Attempting to send ${chunks.length} chunks to ${username}`);

      const player = this.playerManager.getPlayerByUsername(username);
      if (!player) {
         console.error(`❌ Player ${username} not found when trying to send chunks`);
         return;
      }

      // Process chunks in batches
      for (let i = 0; i < chunks.length; i += gameSettings.maxChunkBatchSize) {
         const batchChunks = chunks.slice(i, i + gameSettings.maxChunkBatchSize);

         const chunkData = this.serializeChunkBatch(batchChunks);

         if (chunkData.length === 0) {
            console.error(
               `❌ No chunk data serialized for batch: ${batchChunks.map((c) => `(${c.x},${c.y})`).join(', ')}`,
            );
            continue;
         }

         try {
            this.serverTransport.sendToPlayer(username, ClientBound.UpdateChunks, chunkData);
         } catch (error) {
            console.error(`❌ Failed to send chunks to ${username}:`, error);
         }
      }
   }

   /**
    * Serialize a batch of chunks for network transmission
    */
   private serializeChunkBatch(chunks: { x: number; y: number }[]): SerializedMapChunk[] {
      const chunkData: SerializedMapChunk[] = [];

      for (const chunk of chunks) {
         const mapChunk = this.worldMap.getChunk(chunk.x, chunk.y);
         if (mapChunk) {
            chunkData.push(mapChunk.serialize());
         } else {
            console.warn(`Failed to get chunk (${chunk.x}, ${chunk.y})`);
         }
      }

      return chunkData;
   }

   /**
    * Filter chunk requests to only include valid ones within view distance
    */
   private filterValidChunkRequests(player: BackendPlayer, requests: ChunkRequest[]): { x: number; y: number }[] {
      const playerChunkPos = this.worldToChunkCoords(player.position.x, player.position.y);
      const viewDistance = calculateViewDistanceInChunks(this.tileSize);

      console.log(
         `🔍 Filtering ${requests.length} chunk requests for player at chunk (${playerChunkPos.x}, ${playerChunkPos.y}) with view distance ${viewDistance}`,
      );

      // Use shared utility for consistent validation
      const validRequests = ChunkVisibilityUtils.filterValidChunkRequests(requests, playerChunkPos, viewDistance);

      // Log rejected requests for debugging
      const rejectedRequests = requests.filter((req) => !validRequests.includes(req));
      for (const rejected of rejectedRequests) {
         const isInView = ChunkVisibilityUtils.isChunkInView(
            { x: rejected.chunkX, y: rejected.chunkY },
            playerChunkPos,
            viewDistance,
         );
         console.log(
            `❌ Rejected chunk request (${rejected.chunkX}, ${rejected.chunkY}) - outside view distance (in view: ${isInView})`,
         );
      }

      console.log(`✅ Filtered to ${validRequests.length} valid chunk requests`);

      return validRequests.map((req) => ({ x: req.chunkX, y: req.chunkY }));
   }


   /**
    * Ensure physics bodies exist for a chunk
    */
   private ensureChunkPhysics(chunkX: number, chunkY: number): void {
      const chunkKey = MapChunk.getChunkKey(chunkX, chunkY);
      if (this.chunkPhysicsElements.has(chunkKey)) return;

      const chunk = this.worldMap.getChunk(chunkX, chunkY);
      if (!chunk) return;

      const physicsElements = new Map<string, MapPhysicsElement>();
      const tiles = chunk.getAllTiles();

      // Create physics for non-walkable tiles
      for (let y = 0; y < gameSettings.chunkSize; y++) {
         for (let x = 0; x < gameSettings.chunkSize; x++) {
            const tile = tiles[y][x];
            if (!tile || tile.walkable) continue;

            const element = new MapPhysicsElement(
               this.physicsWorld,
               this.rapier,
               tile.tileType,
               tile.position,
               MapLayer.Walls,
               this.tileSize,
            );

            element.spawn(tile.position, 0);
            physicsElements.set(element.id, element);
         }
      }

      this.chunkPhysicsElements.set(chunkKey, physicsElements);
   }

   /**
    * Remove physics bodies for a chunk
    */
   private removeChunkPhysics(chunkX: number, chunkY: number): void {
      const chunkKey = MapChunk.getChunkKey(chunkX, chunkY);
      const elements = this.chunkPhysicsElements.get(chunkKey);

      if (elements) {
         for (const element of elements.values()) {
            element.despawn();
         }
         this.chunkPhysicsElements.delete(chunkKey);
      }
   }

   /**
    * Update physics for a specific tile
    */
   private updateTilePhysics(tileX: number, tileY: number, updates: any): void {
      if (updates.walkable === undefined && updates.tileType === undefined) return;

      const chunkPos = this.worldToChunkCoords(tileX * this.tileSize, tileY * this.tileSize);
      const chunkKey = MapChunk.getChunkKey(chunkPos.x, chunkPos.y);
      const elements = this.chunkPhysicsElements.get(chunkKey);

      if (!elements) return;

      const worldX = tileX * this.tileSize;
      const worldY = tileY * this.tileSize;

      // Find existing element
      let existingElement: MapPhysicsElement | undefined;
      for (const element of elements.values()) {
         const pos = element.getPosition();
         if (pos.x === worldX && pos.y === worldY) {
            existingElement = element;
            break;
         }
      }

      // Handle walkability changes
      if (updates.walkable === false && !existingElement) {
         // Create new physics element
         const newElement = new MapPhysicsElement(
            this.physicsWorld,
            this.rapier,
            updates.tileType || TileType.Wall,
            { x: worldX, y: worldY },
            MapLayer.Walls,
            this.tileSize,
         );
         newElement.spawn({ x: worldX, y: worldY }, 0);
         elements.set(newElement.id, newElement);
      } else if (updates.walkable === true && existingElement) {
         // Remove existing physics element
         existingElement.despawn();
         elements.delete(existingElement.id);
      }
   }


   /**
    * Buffer a tile update for later network distribution
    */
   private bufferTileUpdate(tileX: number, tileY: number, updates: any): void {
      const chunkPos = this.worldToChunkCoords(tileX * this.tileSize, tileY * this.tileSize);
      const chunkKey = MapChunk.getChunkKey(chunkPos.x, chunkPos.y);

      // Get or create updates buffer for this chunk
      let chunkUpdates = this.chunkUpdatesBuffer.get(chunkKey);
      if (!chunkUpdates) {
         chunkUpdates = new Map();
         this.chunkUpdatesBuffer.set(chunkKey, chunkUpdates);
      }

      // Buffer the update
      const tileKey = `${tileX},${tileY}`;
      let tileUpdates = chunkUpdates.get(tileKey);
      if (!tileUpdates) {
         tileUpdates = {};
         chunkUpdates.set(tileKey, tileUpdates);
      }

      Object.assign(tileUpdates, updates);
   }

   /**
    * Send all buffered updates to subscribed players
    */
   private sendBufferedUpdates(): void {
      // console.log('Sending buffered updates');
      if (this.chunkUpdatesBuffer.size === 0) return;

      console.log(`Sending buffered updates for ${this.chunkUpdatesBuffer.size} chunks`);

      for (const [chunkKey, chunkUpdates] of this.chunkUpdatesBuffer.entries()) {
         const subscribers = this.chunkSubscribers.get(chunkKey);
         if (!subscribers || subscribers.size === 0) continue;

         const updateData = {
            chunkKey,
            tileUpdates: Array.from(chunkUpdates.entries()).map(([tileKey, updates]) => {
               const [tileX, tileY] = tileKey.split(',').map(Number);
               return { tileX, tileY, updates };
            }),
         };

         // Send to all subscribers
         for (const username of subscribers) {
            this.serverTransport.sendToPlayer(username, ClientBound.UpdateTiles, updateData);
         }
      }

      this.chunkUpdatesBuffer.clear();
   }
}
