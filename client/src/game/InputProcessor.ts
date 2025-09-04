import FrontendGame from './FrontendGame';
import { PlayerMoveRequest } from '../../../shared/src/game/network/messages/server-bound/PlayerMoveRequest';
import { FrontendPlayer } from './FrontendPlayer';
import { PlayerAimData } from 'shared/game/network/messages/server-bound/PlayerAimData';
import { ServerBound } from 'shared/game/network/SocketEvents';
import { InputType } from 'shared/game/Controls';
import { ShootRequest } from '../../../shared/src/game/network/messages/ShootingParams';
import { ReloadRequest } from 'shared/dist/game/network/messages/ReloadMessages';

export class InputProcessor {
   private game: FrontendGame;
   /**
    * Buffer storing movement inputs that have been applied locally but not yet processed by the server.
    * Used for client-side prediction and reconciliation.
    */
   private bufferedInput: PlayerMoveRequest[] = [];

   private lastReloadTime: number = 0;
   private readonly RELOAD_INPUT_COOLDOWN = 100;

   constructor(game: FrontendGame) {
      this.game = game;
   }

   /**
    * Main input processing loop that handles all types of player input.
    * Called every frame to process movement, aiming and shooting inputs.
    *
    * @param localPlayer - The client's player instance that inputs will be applied to
    */
   public processInput(localPlayer: FrontendPlayer): void {
      this.handleMovementInput(localPlayer);
      this.handleAimingInput(localPlayer);
      this.handleShootingInput(localPlayer);
      this.handleReloadInput(localPlayer);
   }

   /**
    * NEW: Handle reload input from R key
    */
   private handleReloadInput(localPlayer: FrontendPlayer): void {
      const reloadPressed = this.game.getInputManager().isReloadPressed();
      if (!reloadPressed) return;

      // Prevent reload spam
      const currentTime = performance.now();
      if (currentTime - this.lastReloadTime < this.RELOAD_INPUT_COOLDOWN) {
         return;
      }

      const currentTick = this.game.getPhysicsManager().getGameTick();

      const reloadSuccess = localPlayer.manualReload(currentTick);

      if (reloadSuccess) {
         this.lastReloadTime = currentTime;

         const reloadRequest: ReloadRequest = {
            username: localPlayer.username,
            reloadTick: currentTick,
         };

         this.game.getClientTransport().broadcast(ServerBound.PlayerReload, reloadRequest);
      }
   }

   /**
    * Handles shooting input from mouse clicks.
    * Processes both held mouse button (automatic fire) and single clicks.
    * Creates bullets locally and sends shoot event to server.
    *
    * @param localPlayer - The player doing the shooting
    */
   private handleShootingInput(localPlayer: FrontendPlayer) {
      const mousePressed = this.game.getInputManager().isControlPressed(InputType.SHOOT);
      const clickQueued = this.game.getInputManager().isClickQueued();
      if (!mousePressed && !clickQueued) return;

      const currentTick = this.game.getPhysicsManager().getGameTick();

      const shootResults = localPlayer.shoot(currentTick);

      if (clickQueued) {
         this.game.getInputManager().clearClickQueue();
      }

      if (shootResults.length === 0) return;

      // Create bullet data for each gun
      const shootRequest: ShootRequest = {
         username: localPlayer.username,
         shootTick: currentTick,
         shots: shootResults.map((result) => ({
            gunId: result.gunId,
            origin: result.origin,
            angle: result.angle,
         })),
      };

      this.game.getInputManager().clearClickQueue();

      this.game.getClientTransport().broadcast(ServerBound.PlayerShoot, shootRequest);
   }

   /**
    * Handles aiming input from mouse movement.
    * Updates gun rotations locally and sends aim updates to server.
    *
    * @param localPlayer - The player whose aim is being updated
    */
   /**
    * Handles aiming input from mouse movement.
    * Updates gun rotations locally and sends aim updates to server.
    *
    * @param localPlayer - The player whose aim is being updated
    */
   public handleAimingInput(localPlayer: FrontendPlayer) {
      if (this.game.getInputManager().hasMouseMoved()) {
         const screenPosition = this.game.getInputManager().getMousePosition();
         const worldPosition = this.game.getRenderManager().getCamera().screenToWorldPosition(screenPosition);

         if (worldPosition == null) return;

         localPlayer.aim(worldPosition);

         const currentTime = performance.now();
         const timeSinceLastAim = currentTime - (this.lastAimUpdateTime || 0);
         const AIM_UPDATE_INTERVAL = 50;

         if (timeSinceLastAim >= AIM_UPDATE_INTERVAL) {
            const aimParams: PlayerAimData = {
               username: localPlayer.playerData.username,
               aimPosition: worldPosition,
            };

            this.game.getClientTransport().broadcast(ServerBound.PlayerAim, aimParams);
            this.lastAimUpdateTime = currentTime;
         }
      }
   }

   private lastAimUpdateTime: number = 0;

   /**
    * Handles movement input from keyboard (WASD/arrows).
    * Implements client-side prediction:
    * 1. Stores input in buffer
    * 2. Applies input immediately to local player
    * 3. Sends input to server for validation
    *
    * This allows responsive movement while maintaining server authority.
    * Movement inputs are timestamped for proper reconciliation.
    *
    * @param localPlayer - The player whose movement is being updated
    */
   private handleMovementInput(localPlayer: FrontendPlayer) {
      const currentMovementState = this.game.getInputManager().getCurrentMovementState();
      if (this.game.getInputManager().isAnyMovementKeyPressed(currentMovementState)) {
         const input: PlayerMoveRequest = {
            timestamp: this.game.getPhysicsManager().getCurrentTickTime(),
            input: currentMovementState,
            clientGameTick: this.game.getPhysicsManager().getGameTick(),
         };

         // Store input in buffer
         this.bufferedInput.push(input);

         // Apply input immediately to local player
         localPlayer.move([input]);

         // Send to server
         this.sendMovementUpdatesToServer();
      }
   }

   /**
    * Sends buffered movement inputs to the server.
    * Called after each new input is added to maintain low latency.
    * Clears the buffer after sending to avoid duplicate sends.
    */
   private sendMovementUpdatesToServer(): void {
      if (this.bufferedInput.length > 0) {
         // Send all buffered inputs
         this.game.getClientTransport().broadcast(ServerBound.PlayerMove, [...this.bufferedInput]);

         // Clear the buffer after sending
         this.bufferedInput = [];
      }
   }

   /**
    * Returns the current buffer of unprocessed movement inputs.
    * Used during reconciliation to determine which inputs need to be reapplied.
    */
   public getBufferedInput(): PlayerMoveRequest[] {
      return this.bufferedInput;
   }

   public clearBufferedInput(): void {
      this.bufferedInput = [];
   }

   public setBufferedInput(playerMoveData: PlayerMoveRequest[]): void {
      this.bufferedInput = playerMoveData;
   }
}
