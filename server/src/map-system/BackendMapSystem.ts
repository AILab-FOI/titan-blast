// server/src/map-system/BackendMapSystem.ts
import * as RAPIER from '@dimforge/rapier2d-compat';
import { ServerChunkManager } from './ServerChunkManager';
import { ServerGeckosTransport } from '../network/ServerGeckosTransport';
import { PlayerManager } from '../PlayerManager';
import { TileUpdateData } from 'shared/game/map-system/MapNetworkEvents';
import { BackendPlayer } from '../BackendPlayer';
import { BackendPhysicsManager } from '../BackendPhysicsManager';
import { WorldMap } from 'shared/game/map-system/WorldMap';
import { Position } from 'shared/game/Position';
import { loadFirstTiledMap } from './maps/TiledMapDefinition';
import { BackendGame } from '../BackendGame';

/**
 * Manages the map system on the server side using Tiled maps
 */
export class BackendMapSystem {
   private chunkManager: ServerChunkManager;
   private usedSpawnIndices: Set<number> = new Set();
   private worldMap: WorldMap;

   /**
    * Create a new backend map system
    *
    * @param physicsWorld Physics world
    * @param rapier RAPIER module
    * @param serverTransport Network transport
    * @param playerManager Player manager
    * @param physicsManager Physics manager
    */
   constructor(
      private physicsWorld: RAPIER.World,
      private rapier: typeof RAPIER,
      private serverTransport: ServerGeckosTransport,
      private playerManager: PlayerManager,
      private physicsManager: BackendPhysicsManager,
      private game: BackendGame,
   ) {
      const mapDefinition = loadFirstTiledMap();
      // console.log('map definition: ', mapDefinition);

      this.worldMap = new WorldMap(mapDefinition);

      this.chunkManager = new ServerChunkManager(
         this.worldMap,
         physicsWorld,
         rapier,
         serverTransport,
         playerManager,
         physicsManager,
         game,
      );
   }

   /**
    * Initialize the map system
    */
   public initialize(): void {
      // Initialize chunk manager
      this.chunkManager.initialize();
   }

   /**
    * Handle player movement to update chunk subscriptions
    *
    * @param player The player that moved
    */
   public handlePlayerMove(player: BackendPlayer): void {
      const position = player.position;

      // Update chunk subscriptions based on player position
      this.chunkManager.handlePlayerMove(player, position.x, position.y);
   }

   /**
    * Handle player join
    *
    * @param player The player that joined
    */
   public handlePlayerJoin(player: BackendPlayer): void {
      // Initial chunk loading based on player position
      const position = player.position;
      this.chunkManager.handlePlayerMove(player, position.x, position.y);
   }

   /**
    * Handle player leave
    *
    * @param username Username of the player that left
    */
   public handlePlayerLeave(username: string): void {
      // Remove player from chunk subscribers
      this.chunkManager.handlePlayerDisconnect(username);
   }

   /**
    * Validate if a player is allowed to update a specific tile
    *
    * @param username Username of the player
    * @param update Tile update data
    * @returns Whether the update is allowed
    */
   public validateTileUpdate(username: string, update: TileUpdateData): boolean {
      const player = this.playerManager.getPlayerByUsername(username);
      if (!player) return false;

      const playerPos = player.position;

      const tileSize = this.worldMap.getTileSize();
      const tileWorldX = update.tileX * tileSize;
      const tileWorldY = update.tileY * tileSize;

      const dx = tileWorldX - playerPos.x;
      const dy = tileWorldY - playerPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const maxInteractionDistance = tileSize * 2;

      return distance <= maxInteractionDistance;
   }

   /**
    * Get the next available player spawn position
    *
    * @returns A Position object with the world coordinates where the player should spawn
    */
   public getNextSpawnPosition(): Position {
      const mapDef = this.worldMap.getMapDefinition();

      if (mapDef.playerSpawnPoints && mapDef.playerSpawnPoints.length > 0) {
         const availableIndices = [...Array(mapDef.playerSpawnPoints.length).keys()].filter(
            (index) => !this.usedSpawnIndices.has(index),
         );

         if (availableIndices.length === 0) {
            this.usedSpawnIndices.clear();
            availableIndices.push(...Array(mapDef.playerSpawnPoints.length).keys());
         }

         const spawnIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
         const spawnPoint = mapDef.playerSpawnPoints[spawnIndex];

         this.usedSpawnIndices.add(spawnIndex);

         const position = {
            x: spawnPoint.x,
            y: spawnPoint.y,
         };

         console.log(`Selecting spawn point at world position: (${position.x}, ${position.y})`);
         return position;
      }

      const position = {
         x: 1000 * Math.random(),
         y: 800 * Math.random(),
      };

      console.log(`No spawn points defined, using random position: (${position.x}, ${position.y})`);
      return position;
   }

   /**
    * Get the chunk manager
    */
   public getChunkManager(): ServerChunkManager {
      return this.chunkManager;
   }

   /**
    * Get the world map
    */
   public getWorldMap(): WorldMap {
      return this.worldMap;
   }

   /**
    * Clean up resources
    */
   public cleanup(): void {
      // Clean up chunk manager
      this.chunkManager.cleanup();
   }
}
