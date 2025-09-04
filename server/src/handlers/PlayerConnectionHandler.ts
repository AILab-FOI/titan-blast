// server/src/handlers/PlayerConnectionHandler.ts
import { OnServerMessage } from 'shared/game/network/NetworkMessageDecorators';
import { ClientBound, ServerBound } from 'shared/game/network/SocketEvents';
import { BackendGame } from '../BackendGame';

export class PlayerConnectionHandler {
   private game: BackendGame;

   constructor(game: BackendGame) {
      this.game = game;

      // this.handlePlayerConnect = this.handlePlayerConnect.bind(this);
      // this.handlePlayerDisconnect = this.handlePlayerDisconnect.bind(this);
   }

   @OnServerMessage(ServerBound.PlayerConnect)
   handlePlayerConnect(data: any): void {
      const userData = data.userInfo;
      console.log('PLAYER CONNECTED');

      if (!userData || !userData.username) {
         console.error('Player connection attempted without valid user data:', data);
         return;
      }

      console.log(`Player ${userData.username} (ID: ${userData.id}) connected to game ${this.game.gameId}`);
      const player = this.game.getPlayerManager().addPlayer(data.userInfo);
      if (player) {
         this.handlePlayerJoin(player);
      }
   }

   @OnServerMessage(ServerBound.PlayerDisconnect)
   handlePlayerDisconnect(data: any): void {
      console.log(`Player ${data.username} disconnected: ${data.reason}`, Date.now());
      const player = this.game.getPlayerManager().getPlayerByUsername(data.username);
      if (!player) return;

      // this.game.chunkManager.unmarkChunksForPlayer(player);
      this.game.getPlayerManager().removePlayer(data.username);

      // Handle map system cleanup
      this.game.getMapSystem().handlePlayerLeave(data.username);
   }

   private handlePlayerJoin(player: any): void {
      const mapMetadata = this.game.getMapSystem().getWorldMap().getMetadata();
      this.game.getServerTransport().sendToPlayer(player.username, ClientBound.MapInfo, {
         metadata: mapMetadata,
      });

      // Send current players to the new player
      this.game.getServerTransport().sendToPlayer(player.username, ClientBound.PlayerJoin, {
         players: this.game.getPlayerManager().getAllPlayersData(),
         seed: this.game.getMapSeed(),
         gameRunning: this.game.isGameStarted(),
      });

      // Send the new player to all other players
      this.game.getServerTransport().broadcastExcept(player.username, ClientBound.PlayerJoin, {
         players: [this.game.getPlayerManager().getPlayerData(player)],
         seed: this.game.getMapSeed(),
         gameRunning: this.game.isGameStarted(),
      });

      // Send initial game state to new player if the game is already running
      if (this.game.isGameStarted()) {
         this.game.getServerTransport().sendToPlayer(player.username, ClientBound.StartGame, {
            scheduledStartTime: this.game.getGameLoop().getCurrentTime(),
            serverTick: this.game.getGameLoop().getGameTick(),
            serverTime: this.game.getGameLoop().getCurrentTime(),
         });
      }

      // Handle map system for new player
      this.game.getMapSystem().handlePlayerJoin(player);
   }
}
