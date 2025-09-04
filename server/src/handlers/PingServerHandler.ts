import { BackendGame } from '../BackendGame';
import { OnServerMessage } from 'shared/game/network/NetworkMessageDecorators';
import { ClientBound, ServerBound } from 'shared/game/network/SocketEvents';
import { PingRequestData, PingResponseData } from '../../../shared/src/game/network/PingSystem';

export class PingServerHandler {
   private game: BackendGame;

   constructor(game: BackendGame) {
      this.game = game;
   }

   @OnServerMessage(ServerBound.PingRequest)
   handlePingRequest(data: PingRequestData & { username: string }): void {
      // Echo back the ping with server timestamp
      const response: PingResponseData = {
         clientTimestamp: data.clientTimestamp,
         serverTimestamp: performance.now(),
         requestId: data.requestId,
      };

      // Send response back to the specific player using the username from the enriched data
      this.game.getServerTransport().sendToPlayer(data.username, ClientBound.PingResponse, response);
   }
}