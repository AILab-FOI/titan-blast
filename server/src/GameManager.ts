// server/src/GameManager.ts
import { BackendGame } from './BackendGame';
import http from 'http'

export class GameManager {
   private games: Map<string, BackendGame>;
   private gameCounter: number;

   constructor() {
      this.games = new Map();
      this.gameCounter = 1;
   }

   public async createGame(port: number, server?: http.Server): Promise<string> {
      const gameId = `game-${this.gameCounter}`;
      this.gameCounter += 1;

      if (!this.games.has(gameId)) {
         const game = new BackendGame(gameId);
         await game.init(port, server);
         this.games.set(gameId, game);
      }

      return gameId;
   }

   public hasRunningGame() {
      return this.games.size > 0;
   }

   public getNewestGame(): string | null {
      let newestGameId: string | null = null;
      let maxGameNumber = -1;

      for (const gameId of this.games.keys()) {
         const gameNumber = parseInt(gameId.split('-')[1], 10);
         if (gameNumber > maxGameNumber) {
            maxGameNumber = gameNumber;
            newestGameId = gameId;
         }
      }

      return newestGameId;
   }
}