import { PlayerData } from 'shared/game/PlayerData';
import { BackendPlayer } from './BackendPlayer';
import { PlayerDataToSend } from 'shared/game/network/messages/client-bound/PlayerDataToSend';
import { PlayerMovementState } from '../../shared/src/game/network/messages/client-bound/PlayerMovementState';
import { BackendGame } from './BackendGame';
import { PlayerTypeEnum } from 'shared/game/PlayerTypes';
import { MathUtil } from 'shared/util/MathUtil';
import { gameSettings } from 'shared/game/SystemSettings';

export class PlayerManager {
   /**
    * Map of players by username
    * @private players
    */
   private players: Map<string, BackendPlayer>;
   private minPlayers: number;
   private maxPlayers: number;
   private game: BackendGame;
   private lastEmittedPositions: Map<
      string,
      {
         position: { x: number; y: number };
         rotation: number;
      }
   > = new Map();
   private readonly POSITION_THRESHOLD = 0.5; // Distance in pixels
   private readonly ROTATION_THRESHOLD = 0.1;

   constructor(game: BackendGame, minPlayers: number, maxPlayers: number) {
      this.players = new Map();
      this.minPlayers = minPlayers;
      this.maxPlayers = maxPlayers;
      this.game = game;
   }

   getPlayers() {
      return this.players;
   }

   addPlayer(userInfo: PlayerData): BackendPlayer | null {
      if (this.players.size >= this.maxPlayers) return null;

      const username = userInfo.username;

      // If the player with this username already exists, return it
      if (this.players.has(username)) {
         console.log(`Player with username ${username} already exists, returning existing player`);
         return this.players.get(username)!;
      }

      if (this.game.isGameStarted()) return null;

      const gunSeed = Date.now().toString();
      const playerData = userInfo;

      // Get spawn position from map system
      const spawnPosition = this.game.getMapSystem().getNextSpawnPosition();
      console.log(`Player ${username} spawning at position: (${spawnPosition.x}, ${spawnPosition.y})`);

      const backendPlayer = new BackendPlayer(
         this.game,
         this.game.getWorld(),
         this.game.getRapier(),
         PlayerTypeEnum.Assault,
         playerData,
         gunSeed,
      );
      backendPlayer.spawn(spawnPosition, 0);

      // Using username as the key instead of ID
      this.players.set(username, backendPlayer);

      console.log(`Added player with username ${username}. Currently ${this.players.size} players!`);

      if (this.players.size >= this.minPlayers) {
         this.game.startGame();
      }

      return backendPlayer;
   }

   removePlayer(username: string): void {
      if (this.players.has(username)) {
         this.players.delete(username);

         if (this.players.size === 0) {
            this.game.stopGame();
         }
      }
   }

   getPlayerByUsername(username: string): BackendPlayer | undefined {
      return this.players.get(username);
   }

   getAllPlayersData(): PlayerDataToSend[] {
      const allPlayersData = [];

      for (const [username, backendPlayer] of this.players) {
         const playerDataToSend: PlayerDataToSend = {
            position: {
               x: backendPlayer.position.x,
               y: backendPlayer.position.y,
            },
            playerType: backendPlayer.type,
            playerData: backendPlayer.playerData,
            gunSeed: backendPlayer.gunSeed,
         };

         allPlayersData.push(playerDataToSend);
      }

      return allPlayersData;
   }

   getPlayerUpdates(): PlayerMovementState[] {
      return Array.from(this.players.values())
         .filter((player) => {
            const username = player.playerData.username;
            if (!this.lastEmittedPositions.has(username)) return true;

            const lastEmittedPosition = this.lastEmittedPositions.get(username);
            const linearDistance = MathUtil.distance(lastEmittedPosition!.position, player.position);
            const angularDiff = Math.abs(lastEmittedPosition!.rotation - player.rotationRadians);

            return (
               linearDistance >= gameSettings.minLinearDistanceToUpdateMovement ||
               angularDiff >= gameSettings.minAngularDiffToUpdateMovementRadians
            );
         })
         .map((player) => {
            const username = player.playerData.username;

            // Update last emitted position using username as key
            this.lastEmittedPositions.set(username, {
               position: { ...player.position },
               rotation: player.rotationRadians,
            });

            return {
               username: username, // Use username as player ID in network messages
               position: player.position,
               rotation: player.rotationRadians,
               velocity: player.movementController.getCurrentVelocity(),
               timestamp: this.game.getGameLoop().getCurrentTickTime(),
               gameTick: this.game.getGameLoop().getGameTick(),
               predictionTimestamp: -1,
               predictionTick: -1,
            };
         });
   }

   public getPlayerData(player: BackendPlayer): PlayerDataToSend {
      return {
         position: {
            x: player.position.x,
            y: player.position.y,
         },
         playerType: player.type,
         playerData: player.playerData,
         gunSeed: player.gunSeed,
      };
   }
}
