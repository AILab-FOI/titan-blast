import { FrontendPlayer } from './FrontendPlayer';
import { PlayerMovementState } from '../../../shared/src/game/network/messages/client-bound/PlayerMovementState';
import { PlayerDataToSend } from 'shared/game/network/messages/client-bound/PlayerDataToSend';
import FrontendGame from './FrontendGame';
import { FrontendPlayerJoinEvent } from './events/FrontendPlayerJoinEvent';
import { GameEventEmitter } from 'shared/game/events/GameEventEmitter';

export class PlayerManager {
   private game: FrontendGame;

   /**
    * Map of all players in the game. Keyed by player's username.
    * @private
    */
   private playersMap: Map<string, FrontendPlayer> = new Map();
   private localUsername: string | null = null;

   constructor(game: FrontendGame, localUsername?: string) {
      this.game = game;
      if (localUsername) {
         this.setLocalUsername(localUsername);
      }
   }

   /**
    * Set the username of the local player
    * @param username Username of the local player
    */
   public setLocalUsername(username: string): void {
      console.log('Setting local player username:', username);
      this.localUsername = username;
   }

   /**
    * Check if the given player is the local player
    * @param player Player object or player username
    * @returns true if the player is the local player
    */
   public isLocalPlayer(player: FrontendPlayer | string): boolean {
      if (!this.localUsername) return false;

      const username = typeof player === 'string' ? player : player.playerData.username;
      return username === this.localUsername;
   }

   /**
    * Get the local player instance
    * @returns The local player instance
    * @throws Error if local player is not found
    */
   public getLocalPlayer(): FrontendPlayer {
      if (!this.localUsername) {
         throw new Error('Local player username not set. Call setLocalUsername first.');
      }

      const localPlayer = this.playersMap.get(this.localUsername);
      if (!localPlayer) {
         throw new Error(
            `Local player with username ${this.localUsername} not found in player map. Player may not have joined yet.`,
         );
      }

      return localPlayer;
   }

   /**
    * Safely get the local player instance without throwing errors
    * @returns The local player instance or null if not found
    */
   public getLocalPlayerSafe(): FrontendPlayer | null {
      if (!this.localUsername) return null;
      return this.playersMap.get(this.localUsername) || null;
   }

   /**
    * Creates a new player or updates an existing one based on initial data from server
    */
   public updatePlayerData(data: PlayerDataToSend): void {
      const username = data.playerData.username;
      console.log(`Updating player data for ${username}`);

      const isLocalPlayer = this.isLocalPlayer(username);
      const existingPlayer = this.playersMap.get(username);

      console.log('player CREATED WITH PLAYER DATA', data.playerData);

      if (!existingPlayer) {
         // Create new player
         const player = new FrontendPlayer(
            this.game.getPhysicsManager().getWorld(),
            this.game.getPhysicsManager().getRapier(),
            data.playerType.id,
            data.playerData,
            this.game,
            data.gunSeed,
            isLocalPlayer ? this.game.getRenderManager().playerContainer : this.game.getRenderManager().mapContainer,
            isLocalPlayer,
         );

         // Set initial state
         player.spawn(data.position, 0);
         this.playersMap.set(username, player);
         console.log(`Created new player ${username}`);

         // Handle local player setup
         if (isLocalPlayer) {
            GameEventEmitter.getInstance().emit(new FrontendPlayerJoinEvent(player, true));
         }
      } else {
         // Update existing player's initial state
         existingPlayer.updateState(data.position, 0);
      }
   }

   /**
    * Processes server updates for all players
    */
   public handleServerUpdates(updates: PlayerMovementState[]): void {
      updates.forEach((update) => {
         const player = this.playersMap.get(update.username);
         if (player) {
            player.processServerUpdates(update);
         }
      });
   }

   public getPlayers(): Map<string, FrontendPlayer> {
      return this.playersMap;
   }

   /**
    * Get a player by their ID (not username)
    * @param playerId The player's unique ID
    * @returns The player instance or undefined if not found
    */
   public getPlayerById(playerId: string): FrontendPlayer | undefined {
      // Search through all players to find one with matching ID
      for (const [username, player] of this.playersMap) {
         if (player.id === playerId) {
            return player;
         }
      }
      return undefined;
   }
}
