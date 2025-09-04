// client/src/game/handlers/MapNetworkHandler.ts
import { OnClientMessage } from 'shared/game/network/NetworkMessageDecorators';
import { ClientBound } from 'shared/game/network/SocketEvents';
import FrontendGame from '../FrontendGame';
import { SerializedMapChunk } from 'shared/game/map-system/MapTypes';
import { ChunkTileUpdates } from 'shared/game/map-system/MapNetworkEvents';
import { MapInfoData } from 'shared/game/network/messages/client-bound/MapInfoData';

export class MapNetworkHandler {
   private game: FrontendGame;

   constructor(game: FrontendGame) {
      this.game = game;
   }

   @OnClientMessage(ClientBound.UpdateChunks)
   handleChunkUpdates(chunkDataArray: SerializedMapChunk[] | SerializedMapChunk): void {
      this.game.getMapSystem().getChunkManager().handleChunkUpdates(chunkDataArray);
   }

   @OnClientMessage(ClientBound.UpdateTiles)
   handleTileUpdates(tileUpdates: ChunkTileUpdates): void {
      this.game.getMapSystem().getChunkManager().handleTileUpdates(tileUpdates);
   }

   @OnClientMessage(ClientBound.MapInfo)
   handleMapInfo(data: MapInfoData): void {
      console.log('Received map info:', data.metadata);
      this.game.getMapSystem().getChunkManager().setMapMetadata(data.metadata);
   }
}