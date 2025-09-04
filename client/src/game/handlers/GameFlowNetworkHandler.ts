// client/src/game/handlers/GameFlowNetworkHandler.ts
import { OnClientMessage } from 'shared/game/network/NetworkMessageDecorators';
import { ClientBound } from 'shared/game/network/SocketEvents';
import FrontendGame from '../FrontendGame';
import { GameStartData } from 'shared/game/network/messages/client-bound/GameStartData';

export class GameFlowNetworkHandler {
   private game: FrontendGame;

   constructor(game: FrontendGame) {
      this.game = game;
   }

   @OnClientMessage(ClientBound.StartGame)
   handleStartGame(data: GameStartData): void {
      console.log('Start game event received');

      const currentTime = this.game.getPhysicsManager().getCurrentTime();
      const timeUntilStart = Math.max(0, data.scheduledStartTime - currentTime);

      console.log(
         `Game will start in ${timeUntilStart}ms (local time: ${currentTime}, server scheduled time: ${data.scheduledStartTime})`,
      );

      if (timeUntilStart > 500) {
         console.log(`Countdown: Game starts in ${Math.ceil(timeUntilStart / 1000)} seconds`);
      }

      setTimeout(() => {
         console.log(`Starting game engine now at ${this.game.getPhysicsManager().getCurrentTime()}`);
         this.game.getPhysicsManager().start();
         this.game.getRenderManager().startRendering();
      }, timeUntilStart);
   }

   @OnClientMessage(ClientBound.StopGame)
   handleStopGame(): void {
      this.game.getPhysicsManager().stop();
      this.game.getRenderManager().stopRendering();
   }
}
