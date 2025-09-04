// server/src/index.ts
import { BackendGame } from './BackendGame';
import { config } from 'shared/game/SystemSettings';

const PORT = Number(process.env.PORT || config.port || 3000);

async function startGame() {
   const game = new BackendGame('game-1');

   try {
      await game.init(PORT);

      process.on('SIGINT', async () => {
         console.log('Shutting down server...');
         process.exit(0);
      });
   } catch (error) {
      console.error('Failed to start game:', error);
      process.exit(1);
   }
}

startGame();
