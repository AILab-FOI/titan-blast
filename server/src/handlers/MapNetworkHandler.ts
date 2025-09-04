// server/src/handlers/MapNetworkHandler.ts
import { OnServerMessage } from 'shared/game/network/NetworkMessageDecorators';
import { ServerBound } from 'shared/game/network/SocketEvents';
import { BackendGame } from '../BackendGame';
import { ChunkRequest } from 'shared/game/map-system/MapTypes';
import { TileUpdateData } from 'shared/game/map-system/MapNetworkEvents';

export class MapNetworkHandler {
   private game: BackendGame;

   constructor(game: BackendGame) {
      this.game = game;
   }

   @OnServerMessage(ServerBound.RequestChunks)
   handleChunkRequests(data: any): void {
      // console.log('Raw chunk request data:', data);

      const username = data.username;

      const chunkRequests: ChunkRequest[] = data.value || data;

      if (!username) {
         console.error('No username found in chunk request data:', data);
         return;
      }

      if (!Array.isArray(chunkRequests)) {
         console.error('Chunk requests is not an array:', chunkRequests);
         return;
      }

      this.game.getMapSystem().getChunkManager().handleChunkRequests(username, chunkRequests);
   }

   @OnServerMessage(ServerBound.UpdateTile)
   handleTileUpdate(data: any): void {
      const username = data.username;
      const tileUpdate = data as TileUpdateData;

      // Validate that player is allowed to update this tile
      if (this.game.getMapSystem().validateTileUpdate(username, tileUpdate)) {
         this.game.getMapSystem().getChunkManager().updateTile(tileUpdate.tileX, tileUpdate.tileY, tileUpdate.updates);
      }
   }
}
