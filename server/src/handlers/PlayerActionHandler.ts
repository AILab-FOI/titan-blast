// server/src/handlers/PlayerActionHandler.ts
import { OnServerMessage } from 'shared/game/network/NetworkMessageDecorators';
import { ClientBound, ServerBound } from 'shared/game/network/SocketEvents';
import { BackendGame } from '../BackendGame';
import { ShootRequest } from 'shared/game/network/messages/ShootingParams';
import { PlayerAimData } from 'shared/game/network/messages/server-bound/PlayerAimData';
import { gameSettings } from 'shared/game/SystemSettings';
import { ReloadRequest } from '../../../shared/src/game/network/messages/ReloadMessages';
import { BackendPlayer } from '../BackendPlayer';

export class PlayerActionHandler {
   private game: BackendGame;

   constructor(game: BackendGame) {
      this.game = game;
   }

   @OnServerMessage(ServerBound.PlayerMove)
   handlePlayerMove(data: any): void {
      const username = data.username;

      const player = this.game.getPlayerManager().getPlayerByUsername(username);
      if (!player) return;

      const numericKeys = Object.keys(data).filter((key) => !isNaN(Number(key)));
      if (numericKeys.length === 0) return; // No movement data found

      const playerMoveDataArray = numericKeys.map((key) => data[key]);

      const serverPlayerMoveData = playerMoveDataArray.map((moveData) => ({
         ...moveData,
         receivedAtTick: this.game.getGameLoop().getGameTick(),
      }));

      this.game.getPlayerMovementInputs().addInputBatch(username, serverPlayerMoveData);
      player.movementController.move(playerMoveDataArray);

      const mapTileSize = this.game.getMapSystem().getWorldMap().getTileSize();
      const newChunkX = Math.floor(player.position.x / (mapTileSize * gameSettings.chunkSize));
      const newChunkY = Math.floor(player.position.y / (mapTileSize * gameSettings.chunkSize));

      if (player.hasChangedChunk(newChunkX, newChunkY)) {
         player.updateChunkPosition(newChunkX, newChunkY);
         this.game.getMapSystem().handlePlayerMove(player);
      }
   }

   @OnServerMessage(ServerBound.PlayerShoot)
   handlePlayerShoot(data: any): void {
      const player = this.game.getPlayerManager().getPlayerByUsername(data.username);
      if (!player) return;

      const shootRequest = data as ShootRequest;
      if (!shootRequest) {
         console.warn('Invalid shoot request format');
         return;
      }

      console.log(`SHOOT REQUEST RECEIVED AT: ${this.game.getPhysicsManager().getCurrentTime()}`);

      const shootResults = player.validateAndShoot(shootRequest);
      if (shootResults.length === 0) return;

      const serverShootEventData = {
         username: player.playerData.username,
         tickShotAt: shootRequest.shootTick,
         shots: shootResults.map((result) => ({
            gunId: result.gunId,
            origin: result.origin,
            angle: result.angle,
            hits: result.hits.map((hit) => ({
               position: hit.position,
               entityId: hit.entityId,
               distance: hit.distance,
            })),
         })),
      };

      this.game.getServerTransport().broadcast(ClientBound.PlayerShoot, serverShootEventData);
   }

   @OnServerMessage(ServerBound.PlayerAim)
   handlePlayerAim(data: PlayerAimData): void {
      if (!data || !data.aimPosition) {
         console.warn('Invalid aim data format');
         return;
      }

      const player = this.game.getPlayerManager().getPlayerByUsername(data.username);
      if (!player) {
         console.warn(`Player ${data.username} not found for aim update`);
         return;
      }

      const distance = Math.sqrt(
         Math.pow(data.aimPosition.x - player.position.x, 2) + Math.pow(data.aimPosition.y - player.position.y, 2),
      );

      const MAX_AIM_DISTANCE = 2000;
      if (distance > MAX_AIM_DISTANCE) {
         console.warn(`Player ${data.username} aim position too far: ${distance} pixels`);
         return;
      }

      this.game.getServerTransport().broadcastExcept(data.username, ClientBound.PlayerAim, data);
   }

   @OnServerMessage(ServerBound.PlayerReload)
   handlePlayerReload(data: ReloadRequest): void {
      const player = this.game.getPlayerManager().getPlayerByUsername(data.username) as BackendPlayer;
      if (!player) {
         console.warn(`Reload request from unknown player: ${data.username}`);
         return;
      }

      const currentTick = this.game.getPhysicsManager().getGameTick();

      const success = player.manualReload(currentTick);
      if (!success) {
         console.warn(`Failed to reload gun for player ${data.username}`);
      }
   }
}
