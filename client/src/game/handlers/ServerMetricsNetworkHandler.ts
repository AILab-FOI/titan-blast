import { OnClientMessage } from 'shared/game/network/NetworkMessageDecorators';
import { ClientBound } from 'shared/game/network/SocketEvents';
import FrontendGame from '../FrontendGame';
import { ServerMetricsData } from 'shared/game/network/messages/client-bound/ServerMetricsData';
import { PingResponseData } from '../../../../shared/src/game/network/PingSystem';

export class ServerMetricsNetworkHandler {
   private game: FrontendGame;

   constructor(game: FrontendGame) {
      this.game = game;
   }

   @OnClientMessage(ClientBound.ServerMetrics)
   handleServerMetrics(data: ServerMetricsData): void {
      this.game.getPerformanceMonitor().updateServerMetrics(data.tps, data.physicsStepTimeMs, data.tickTimeMs);
   }

   @OnClientMessage(ClientBound.PingResponse)
   handlePingResponse(data: PingResponseData): void {
      // Forward to the ping manager in the client transport
      const transport = this.game.getClientTransport();
      if (transport && transport.getPingManager) {
         transport.getPingManager().handlePingResponse(data);
      }
   }
}
