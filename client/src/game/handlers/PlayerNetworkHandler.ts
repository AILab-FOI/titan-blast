// client/src/game/handlers/PlayerNetworkHandler.ts
import { OnClientMessage } from 'shared/game/network/NetworkMessageDecorators';
import { ClientBound } from 'shared/game/network/SocketEvents';
import FrontendGame from '../FrontendGame';
import { PlayerDataToSend } from 'shared/game/network/messages/client-bound/PlayerDataToSend';
import { ServerShootEventData } from 'shared/game/network/messages/client-bound/ServerShootEventData';
import { PlayerAimData } from 'shared/game/network/messages/server-bound/PlayerAimData';
import { GunStateSync, ReloadEvent } from '../../../../shared/src/game/network/messages/ReloadMessages';
import { FrontendPlayer } from '../FrontendPlayer';
import { FrontendGun } from '../shooting/FrontendGun';
import { PlayerMovementState } from '../../../../shared/src/game/network/messages/client-bound/PlayerMovementState';

export class PlayerNetworkHandler {
   private game: FrontendGame;

   constructor(game: FrontendGame) {
      this.game = game;
   }

   @OnClientMessage(ClientBound.PlayerJoin)
   handlePlayerJoin(data: { players: PlayerDataToSend[]; seed: string; gameRunning: boolean }): void {
      console.log(data.seed, data.gameRunning, data.players.length, data.players);
      data.players.forEach((playerData: PlayerDataToSend) => {
         this.game.getPlayerManager().updatePlayerData(playerData);
      });
      this.game.getRenderManager().startRendering();
      console.log('started rendering');
   }

   @OnClientMessage(ClientBound.PlayerShoot)
   handlePlayerShoot(data: ServerShootEventData): void {
      const player = this.game.getPlayerManager().getPlayers().get(data.username);
      if (player && !this.game.getPlayerManager().isLocalPlayer(player)) {
         player.visualizeRemoteShot(data);
      }
   }

   @OnClientMessage(ClientBound.PlayerAim)
   handlePlayerAim(data: PlayerAimData): void {
      const player = this.game.getPlayerManager().getPlayers().get(data.username);
      if (player && !this.game.getPlayerManager().isLocalPlayer(player)) {
         // Use the new setRemoteAimPosition method for smooth interpolation
         player.setRemoteAimPosition(data.aimPosition);
      }
   }

   @OnClientMessage(ClientBound.PlayerDisconnect)
   handlePlayerDisconnect(playerId: string): void {
      // Handle player disconnect
      console.log(`Player disconnected: ${playerId}`);
   }

   @OnClientMessage(ClientBound.UpdateAllPlayers)
   handleUpdateAllPlayers(data: PlayerMovementState[]): void {
      this.game.getPlayerManager().handleServerUpdates(data);
   }

   @OnClientMessage(ClientBound.ReloadEvent)
   handleReloadEvent(data: ReloadEvent): void {
      const player = this.game.getPlayerManager().getPlayerById(data.playerId) as FrontendPlayer;
      if (!player) {
         console.warn(`Reload event for unknown player: ${data.playerId}`);
         return;
      }

      const gun = player.getGun() as FrontendGun;
      if (!gun) {
         console.warn(`Player ${data.playerId} has no gun`);
         return;
      }

      if (gun.id !== data.gunId) {
         console.warn(`Gun ID mismatch: expected ${gun.id}, got ${data.gunId}`);
         return;
      }

      gun.handleServerReloadEvent(data);
   }

   @OnClientMessage(ClientBound.GunStateSync)
   handleGunStateSync(data: GunStateSync): void {
      const player = this.game.getPlayerManager().getPlayerById(data.playerId) as FrontendPlayer;
      if (!player) {
         console.warn(`Gun state sync for unknown player: ${data.playerId}`);
         return;
      }

      const gun = player.getGun() as FrontendGun;

      if (!gun) {
         console.warn('player doesnt have a gun');
         return;
      }

      console.log('SYNCING GUN');
      gun.syncFromServer(data);
   }
}
