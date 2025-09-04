import { MovementController } from './MovementController';
import { PlayerMoveRequest } from '../network/messages/server-bound/PlayerMoveRequest';
import { Player } from '../Player';
import { InputType } from '../Controls';
import * as RAPIER from '@dimforge/rapier2d-compat';
import { physicsToPixel, pixelToPhysics } from '../../util/Utils';
import { gameSettings } from '../SystemSettings';

export class CharacterMovementController implements MovementController {
   private characterController: RAPIER.KinematicCharacterController | null = null;
   private player: Player;

   // MOVEMENT STATE PROPERTIES:
   private currentVelocity: { x: number; y: number } = { x: 0, y: 0 };
   private targetVelocity: { x: number; y: number } = { x: 0, y: 0 };
   private readonly acceleration = 0.25; // How quickly to reach target velocity (0-1)
   private readonly deceleration = 0.3; // How quickly to stop when no input (0-1)

   // INPUT TRACKING:
   private lastInputState: { [key: string]: boolean } = {};
   private hasActiveInput: boolean = false;
   private lastMoveCallTick: number = -1;

   constructor(player: Player) {
      this.player = player;
      this.initializeCharacterController();
      this.startMovementTicking();
   }

   private initializeCharacterController(): void {
      try {
         const world = this.player.game.getPhysicsManager().getWorld();

         if (!world) {
            console.error('World not available for character controller');
            return;
         }

         this.characterController = world.createCharacterController(pixelToPhysics(0.5));

         this.setupCharacterController();
      } catch (error) {
         console.error('Failed to initialize character controller:', error);
      }
   }

   private setupCharacterController(): void {
      if (!this.characterController) return;

      this.characterController.setUp({ x: 0.0, y: -1.0 });
      this.characterController.setSlideEnabled(true);
      this.characterController.disableAutostep();
      this.characterController.disableSnapToGround();
      this.characterController.setApplyImpulsesToDynamicBodies(false);
      this.characterController.setCharacterMass(1.0);
   }

   /**
    * Start the movement ticking system - runs every physics tick
    */
   private startMovementTicking(): void {
      // Schedule a repeating task that runs every tick
      this.player.game.getPhysicsManager().scheduleRepeatingTask(
         () => this.updateMovement(),
         1, // Every tick
      );
   }

   /**
    * Called from input system when player provides input
    * Now just updates target velocity, doesn't perform movement
    */
   public move(playerMoveData: PlayerMoveRequest[]): void {
      this.lastMoveCallTick = this.player.game.getPhysicsManager().getGameTick();
      this.targetVelocity.x = 0;
      this.targetVelocity.y = 0;
      this.hasActiveInput = false;

      if (!playerMoveData || playerMoveData.length === 0) {
         // No input this frame - target velocity already set to zero above
         return;
      }

      // Process input to determine target velocity
      let targetVelocityX = 0;
      let targetVelocityY = 0;

      for (const moveUpdate of playerMoveData) {
         const { timestamp, input } = moveUpdate;

         if (input[InputType.UP]) {
            targetVelocityY -= 1;
            this.hasActiveInput = true;
         }
         if (input[InputType.DOWN]) {
            targetVelocityY += 1;
            this.hasActiveInput = true;
         }
         if (input[InputType.LEFT]) {
            targetVelocityX -= 1;
            this.hasActiveInput = true;
         }
         if (input[InputType.RIGHT]) {
            targetVelocityX += 1;
            this.hasActiveInput = true;
         }

         this.player.lastProcessedTick = timestamp;
         this.lastInputState = { ...input };
      }

      // Normalize diagonal movement
      if (this.hasActiveInput) {
         // Normalize diagonal movement
         if (targetVelocityX !== 0 && targetVelocityY !== 0) {
            const length = Math.sqrt(targetVelocityX * targetVelocityX + targetVelocityY * targetVelocityY);
            targetVelocityX /= length;
            targetVelocityY /= length;
         }

         this.targetVelocity.x = targetVelocityX * this.player.movementSpeed;
         this.targetVelocity.y = targetVelocityY * this.player.movementSpeed;
      }
   }

   /**
    * Called every physics tick to update movement with damping
    * This runs regardless of whether there's input or not
    */
   private updateMovement(): void {
      if (!this.characterController) {
         return;
      }

      const currentTick = this.player.game.getPhysicsManager().getGameTick();

      this.hasActiveInput = this.lastMoveCallTick === currentTick;

      // Apply damping/acceleration every tick
      const lerpFactor = this.hasActiveInput ? this.acceleration : this.deceleration;

      // Smoothly interpolate current velocity towards target velocity
      this.currentVelocity.x += (this.targetVelocity.x - this.currentVelocity.x) * lerpFactor;
      this.currentVelocity.y += (this.targetVelocity.y - this.currentVelocity.y) * lerpFactor;

      // Apply stop threshold to completely stop movement when close to zero
      const stopThreshold = 0.1;
      if (Math.abs(this.currentVelocity.x) < stopThreshold) this.currentVelocity.x = 0;
      if (Math.abs(this.currentVelocity.y) < stopThreshold) this.currentVelocity.y = 0;

      if (!this.hasActiveInput) {
         this.targetVelocity.x = 0;
         this.targetVelocity.y = 0;
      }

      // Convert to movement delta for this frame
      const deltaTime = gameSettings.gameDeltaUpdateSeconds;
      const desiredMovement = {
         x: pixelToPhysics(this.currentVelocity.x * deltaTime),
         y: pixelToPhysics(this.currentVelocity.y * deltaTime),
      };

      // Skip movement calculation if velocity is essentially zero
      if (Math.abs(this.currentVelocity.x) < 0.01 && Math.abs(this.currentVelocity.y) < 0.01) {
         return;
      }

      const playerCollider = this.getPlayerCollider();
      if (!playerCollider) {
         return;
      }

      try {
         this.characterController.computeColliderMovement(playerCollider, desiredMovement);
         const computedMovement = this.characterController.computedMovement();

         const currentPos = this.player.position;
         const newPosition = {
            x: currentPos.x + physicsToPixel(computedMovement.x),
            y: currentPos.y + physicsToPixel(computedMovement.y),
         };

         this.player.setPosition(newPosition);
      } catch (error) {
         console.error('Error during character controller movement:', error);
      }
   }

   private getPlayerCollider(): RAPIER.Collider | null {
      try {
         const body = this.player.body;
         return body.collider(0);
      } catch (error) {
         console.error('Error getting player collider:', error);
         return null;
      }
   }

   public cleanup(): void {
      if (this.characterController) {
         try {
            const world = this.player.game.getPhysicsManager().getWorld();
            if (world) {
               world.removeCharacterController(this.characterController);
            }
            this.characterController = null;
         } catch (error) {
            console.error('Error cleaning up character controller:', error);
         }
      }
   }

   public getCurrentVelocity(): { x: number; y: number } {
      return { ...this.currentVelocity };
   }

   public getTargetVelocity(): { x: number; y: number } {
      return { ...this.targetVelocity };
   }

   public hasInput(): boolean {
      return this.hasActiveInput;
   }
}
