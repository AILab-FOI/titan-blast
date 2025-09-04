// client/src/game/rendering/animation/AnimatedPlayerRenderComponent.ts

import { RenderComponent, RenderConfig } from '../RenderComponent';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { AnimationState, EntityShape, PlayerType } from 'shared/game/PlayerTypes';
import { Position } from 'shared/game/Position';
import { AnimationFrameRates, AnimationManager } from './AnimationManager';
import { PlayerNameLabel } from '../../ui/PlayerNameLabel';

export interface AnimatedRenderConfig extends RenderConfig {
   animationFrameRates?: AnimationFrameRates;
}

export class AnimatedPlayerRenderComponent extends RenderComponent {
   public bodyContainer!: Container;
   public gunContainer!: Container;
   public sprite!: Sprite; // Add sprite property for compatibility

   private animationManager: AnimationManager;
   private lastVelocity: { x: number; y: number } = { x: 0, y: 0 };
   private isMoving: boolean = false;
   private lastAimDirection: number = 1; // 1 for right, -1 for left

   // For remote player movement detection
   private lastMovementUpdateTime: number = 0;
   private isRemotePlayer: boolean = false;
   private readonly MOVEMENT_TIMEOUT_MS = 120; // 3 frames * 40ms = 120ms

   private nameLabel: PlayerNameLabel | null = null;

   constructor(
      characterTextures: Record<string, Texture>,
      renderConfig: AnimatedRenderConfig,
      parentContainer: Container,
      isLocalEntity: boolean = false,
      useInterpolation: boolean = true,
      playerName?: string,
      playerType?: PlayerType,
   ) {
      // Use a default texture for the base RenderComponent
      const defaultTexture = Object.values(characterTextures)[0] || Texture.WHITE;

      super(defaultTexture, renderConfig, parentContainer, isLocalEntity, useInterpolation);

      this.isRemotePlayer = !isLocalEntity;

      this.animationManager = new AnimationManager(characterTextures, renderConfig.animationFrameRates);

      this.animationManager.playAnimation(AnimationState.IDLE);
      console.log(
         `AnimatedPlayerRenderComponent: Initialized ${isLocalEntity ? 'local' : 'remote'} player with idle animation`,
      );

      if (playerName && playerType) {
         this.createNameLabel(playerName, playerType);
      }
   }

   protected createContainerStructure(texture: Texture): Container {
      // Create main container for position updates
      const mainContainer = new Container();

      // Create body container for character sprite and rotation
      this.bodyContainer = new Container();
      this.sprite = new Sprite(texture);
      this.sprite.anchor.set(0.5);
      this.bodyContainer.addChild(this.sprite);

      // Create gun container for weapons
      this.gunContainer = new Container();

      // Add both to main container
      mainContainer.addChild(this.bodyContainer);
      mainContainer.addChild(this.gunContainer);

      return mainContainer;
   }

   protected setupShape(config: RenderConfig): void {
      switch (config.shape) {
         case EntityShape.Cuboid:
            if (!config.dimensions.width || !config.dimensions.height) {
               throw new Error('Cuboid shape requires width and height dimensions');
            }
            this.sprite.width = config.dimensions.width;
            this.sprite.height = config.dimensions.height;
            break;

         case EntityShape.Circle: {
            if (!config.dimensions.radius) {
               throw new Error('Circle shape requires radius dimension');
            }
            const diameter = config.dimensions.radius * 2;
            this.sprite.width = diameter;
            this.sprite.height = diameter;

            const mask = new Graphics();
            mask.fill(0xffffff);
            mask.circle(0, 0, diameter / 2);
            mask.fill();
            this.container.addChild(mask);
            this.sprite.mask = mask;
            break;
         }

         case EntityShape.Capsule: {
            if (!config.dimensions.radius || !config.dimensions.height) {
               throw new Error('Capsule shape requires radius and height dimensions');
            }
            const capsuleWidth = config.dimensions.radius * 2;
            const capsuleHeight = config.dimensions.height;
            this.sprite.width = capsuleWidth;
            this.sprite.height = capsuleHeight;

            const capsuleMask = new Graphics();
            capsuleMask.fill(0xffffff);
            capsuleMask.rect(
               -capsuleWidth / 2,
               -capsuleHeight / 2 + capsuleWidth / 2,
               capsuleWidth,
               capsuleHeight - capsuleWidth,
            );
            capsuleMask.circle(0, -capsuleHeight / 2 + capsuleWidth / 2, capsuleWidth / 2);
            capsuleMask.circle(0, capsuleHeight / 2 - capsuleWidth / 2, capsuleWidth / 2);
            capsuleMask.fill();
            this.container.addChild(capsuleMask);
            this.sprite.mask = capsuleMask;
            break;
         }
      }
   }

   public getPosition(): Position {
      return {
         x: this.container.position.x,
         y: this.container.position.y,
      };
   }

   public setPosition(position: Position): void {
      this.container.position.set(position.x, position.y);
   }

   public getRotation(): number {
      return this.bodyContainer.rotation;
   }

   public setRotation(rotation: number): void {
      this.bodyContainer.rotation = rotation;
   }

   /**
    * Update sprite flipping based on aim direction
    */
   public updateAimDirection(aimAngle: number): void {
      const normalizedAngle = Math.atan2(Math.sin(aimAngle), Math.cos(aimAngle));

      const aimingLeft = Math.abs(normalizedAngle) > Math.PI / 2;
      const newDirection = aimingLeft ? -1 : 1;

      if (newDirection !== this.lastAimDirection) {
         this.sprite.scale.x = Math.abs(this.sprite.scale.x) * newDirection;
         this.lastAimDirection = newDirection;
      }
   }

   /**
    * Update animation based on movement
    */
   public updateMovement(velocity: { x: number; y: number }): void {
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      const movementThreshold = 15.0;
      const isCurrentlyMoving = speed > movementThreshold;

      if (this.isRemotePlayer && isCurrentlyMoving) {
         this.lastMovementUpdateTime = performance.now();
      }

      // Only change animation if movement state changed
      if (isCurrentlyMoving !== this.isMoving) {
         this.isMoving = isCurrentlyMoving;

         if (this.isMoving) {
            // console.log(
            //    `AnimatedPlayerRenderComponent: ${this.isRemotePlayer ? 'Remote' : 'Local'} player switching to MOVING animation`,
            // );
            this.animationManager.playAnimation(AnimationState.MOVE);
         } else {
            // console.log(
            //    `AnimatedPlayerRenderComponent: ${this.isRemotePlayer ? 'Remote' : 'Local'} player switching to IDLE animation`,
            // );
            this.animationManager.playAnimation(AnimationState.IDLE);
         }
      }

      this.lastVelocity = { ...velocity };
   }

   /**
    * Check if remote player should be considered stopped due to lack of updates
    */
   private checkRemotePlayerTimeout(): void {
      if (!this.isRemotePlayer || !this.isMoving) return;

      const currentTime = performance.now();
      const timeSinceLastUpdate = currentTime - this.lastMovementUpdateTime;

      if (timeSinceLastUpdate > this.MOVEMENT_TIMEOUT_MS) {
         // console.log(
         //    `AnimatedPlayerRenderComponent: Remote player movement timeout (${timeSinceLastUpdate.toFixed(1)}ms since last update), switching to IDLE`,
         // );
         this.isMoving = false;
         this.animationManager.playAnimation(AnimationState.IDLE);
      }
   }

   /**
    * Play death animation
    */
   public playDeathAnimation(): void {
      console.log('AnimatedPlayerRenderComponent: Playing DEATH animation');
      this.animationManager.playAnimation(AnimationState.DEATH);
   }

   /**
    * Update method override to handle animations
    */
   public update(): void {
      super.update();

      // Check for remote player movement timeout
      this.checkRemotePlayerTimeout();

      // Update animation and apply new texture
      const newTexture = this.animationManager.update();
      if (newTexture && this.sprite.texture !== newTexture) {
         this.sprite.texture = newTexture;
      }
   }

   public rotateGuns(angle: number): void {
      this.gunContainer.rotation = angle;

      // Update sprite flipping based on gun rotation
      this.updateAimDirection(angle);
   }

   public getGunsRotation(): number {
      return this.gunContainer.rotation;
   }

   /**
    * Get current animation state
    */
   public getCurrentAnimationState(): AnimationState {
      return this.animationManager.getCurrentAnimation();
   }

   /**
    * Check if death animation is complete
    */
   public isDeathAnimationComplete(): boolean {
      return (
         this.animationManager.getCurrentAnimation() === AnimationState.DEATH &&
         this.animationManager.isAnimationComplete()
      );
   }

   private createNameLabel(playerName: string, playerType: PlayerType): void {
      this.nameLabel = new PlayerNameLabel(playerName);

      this.container.addChild(this.nameLabel.getContainer());

      const characterHeight = this.getCharacterHeight(playerType);
      this.nameLabel.setPosition(characterHeight);
   }

   /**
    * Calculate character height based on player type physics config
    */
   private getCharacterHeight(playerType: PlayerType): number {
      const dimensions = playerType.physics.collider.dimensions;

      switch (playerType.physics.collider.shape) {
         case EntityShape.Cuboid:
            return dimensions.height || 0;

         case EntityShape.Circle:
            return dimensions.radius ? dimensions.radius * 2 : 0;

         case EntityShape.Capsule:
            return dimensions.height || 0;

         default:
            return this.sprite.height;
      }
   }

   public setNameVisible(visible: boolean): void {
      if (this.nameLabel) {
         this.nameLabel.setVisible(visible);
      }
   }
}
