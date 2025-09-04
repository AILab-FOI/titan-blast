// client/src/game/rendering/animation/AnimatedEntityRenderComponent.ts - Enhanced with proper animation

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { RenderConfig } from '../RenderComponent';
import { EntityShape } from 'shared/game/PlayerTypes';

/**
 * Configuration for animated entity rendering
 */
export interface AnimatedEntityConfig extends RenderConfig {
   animationFrameRates: Record<string, number>;
}

/**
 * Animation frame data
 */
export interface AnimationFrame {
   texture: Texture;
   label: string;
}

/**
 * Animation sequence data
 */
export interface AnimationSequence {
   state: string;
   frames: AnimationFrame[];
   frameRate: number;
   loop: boolean;
}

/**
 * Generic animated render component that can be used for players, enemies, and other entities
 * Uses AssetLoader textures and supports configurable animations with proper frame advancement
 */
export class AnimatedEntityRenderComponent {
   protected container: Container;
   protected sprite!: Sprite;
   protected bodyContainer!: Container;
   protected gunContainer?: Container; // Optional for entities that have weapons

   // Animation properties
   private animations: Map<string, AnimationSequence> = new Map();
   private currentAnimation: string = 'idle';
   private currentFrame: number = 0;
   private lastFrameTime: number = 0;
   private isAnimating: boolean = true;

   // Animation frame rates
   private frameRates: Record<string, number> = {};

   constructor(
      textures: Record<string, Texture>,
      config: AnimatedEntityConfig,
      entityType: 'player' | 'enemy' = 'enemy',
   ) {
      this.frameRates = config.animationFrameRates;

      // Load animations from textures
      this.loadAnimations(textures);

      // Create container structure
      this.container = this.createContainerStructure(textures);
      this.setupShape(config);

      // Set initial animation and ensure first frame is displayed
      this.setAnimation('idle');

      // console.log(`Created animated ${entityType} render component with ${this.animations.size} animations`);
   }

   /**
    * Load animations from texture collection following the naming convention
    */
   private loadAnimations(textures: Record<string, Texture>): void {
      // Group textures by animation state
      const animationGroups: Record<string, AnimationFrame[]> = {};

      for (const [textureName, texture] of Object.entries(textures)) {
         // Skip textures that don't follow the animation naming convention
         if (!textureName.includes('_')) {
            // Single frame textures might be idle states
            if (textureName.toLowerCase().includes('idle') || Object.keys(textures).length === 1) {
               if (!animationGroups['idle']) {
                  animationGroups['idle'] = [];
               }
               animationGroups['idle'].push({
                  texture,
                  label: textureName,
               });
            }
            continue;
         }

         const parts = textureName.split('_');
         if (parts.length < 2) continue;

         const animationName = parts[0].toLowerCase();
         const frameNumber = parts[1].replace(/\.[^/.]+$/, ''); // Remove file extension

         if (!animationGroups[animationName]) {
            animationGroups[animationName] = [];
         }

         animationGroups[animationName].push({
            texture,
            label: textureName,
         });
      }

      // Create animation sequences
      for (const [animationName, frames] of Object.entries(animationGroups)) {
         // Sort frames by their numeric suffix
         frames.sort((a, b) => {
            const aLabel = a.label || '';
            const bLabel = b.label || '';

            const aParts = aLabel.split('_');
            const bParts = bLabel.split('_');

            // Get the frame number, defaulting to 0 if parsing fails
            const aFrameStr = aParts.length > 1 ? aParts.pop() || '0' : '0';
            const bFrameStr = bParts.length > 1 ? bParts.pop() || '0' : '0';

            const aNum = parseInt(aFrameStr.replace(/\.[^/.]+$/, '')) || 0;
            const bNum = parseInt(bFrameStr.replace(/\.[^/.]+$/, '')) || 0;

            return aNum - bNum;
         });

         // Determine frame rate and loop behavior
         const frameRate = this.frameRates[animationName] || this.getDefaultFrameRate(animationName);
         const loop = animationName !== 'attacking' && animationName !== 'ability'; // Attack animations shouldn't loop

         const sequence: AnimationSequence = {
            state: animationName,
            frames,
            frameRate,
            loop,
         };

         this.animations.set(animationName, sequence);
         // console.log(`Loaded ${animationName} animation with ${frames.length} frames at ${frameRate} FPS`);
      }

      // Ensure we have at least an idle animation
      if (!this.animations.has('idle')) {
         // console.warn('No idle animation found - creating default from first available texture');
         const firstTexture = Object.values(textures)[0];
         if (firstTexture) {
            this.animations.set('idle', {
               state: 'idle',
               frames: [{ texture: firstTexture, label: 'default' }],
               frameRate: 1,
               loop: true,
            });
         }
      }
   }

   /**
    * Get default frame rate for animation state
    */
   private getDefaultFrameRate(animationName: string): number {
      switch (animationName.toLowerCase()) {
         case 'idle':
            return 2;
         case 'moving':
         case 'walk':
         case 'run':
            return 6;
         case 'attacking':
         case 'attack':
            return 8;
         case 'ability':
            return 4;
         default:
            return 4;
      }
   }

   /**
    * Create container structure for the entity
    */
   private createContainerStructure(textures: Record<string, Texture>): Container {
      // Main container for the entire entity
      this.container = new Container();

      // Body container for rotation and scaling
      this.bodyContainer = new Container();
      this.container.addChild(this.bodyContainer);

      // Create main sprite with first available texture
      const firstTexture = Object.values(textures)[0] || Texture.WHITE;
      this.sprite = new Sprite(firstTexture);
      this.sprite.anchor.set(0.5);
      this.bodyContainer.addChild(this.sprite);

      return this.container;
   }

   /**
    * Setup entity shape and dimensions
    */
   private setupShape(config: AnimatedEntityConfig): void {
      switch (config.shape) {
         case EntityShape.Circle: {
            if (!config.dimensions.radius) {
               throw new Error('Circle shape requires radius dimension');
            }
            const diameter = config.dimensions.radius * 2;
            this.sprite.width = diameter;
            this.sprite.height = diameter;

            // Create circular mask
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
            break;
         }

         default:
            // Use dimensions from config or keep original texture size
            if (config.dimensions.width && config.dimensions.height) {
               this.sprite.width = config.dimensions.width;
               this.sprite.height = config.dimensions.height;
            }
            break;
      }
   }

   /**
    * Set the current animation
    */
   public setAnimation(animationName: string): void {
      if (this.currentAnimation === animationName) return;

      const animationSequence = this.animations.get(animationName);
      if (!animationSequence) {
         // console.warn(
         //    `Animation "${animationName}" not found, available: ${Array.from(this.animations.keys()).join(', ')}`,
         // );

         // Try fallback to idle
         if (animationName !== 'idle' && this.animations.has('idle')) {
            animationName = 'idle';
         } else {
            return; // Can't set animation
         }
      }

      // console.log(`Setting animation to: ${animationName}`);
      this.currentAnimation = animationName;
      this.currentFrame = 0;
      this.lastFrameTime = performance.now();

      // Update to first frame of new animation
      this.updateCurrentFrame();
   }

   public update(): Texture | null {
      if (!this.isAnimating) return null;

      const currentTime = performance.now();
      const animationSequence = this.animations.get(this.currentAnimation);

      if (!animationSequence || animationSequence.frames.length === 0) {
         return null;
      }

      // Calculate frame interval in milliseconds
      const frameInterval = 1000 / animationSequence.frameRate;

      // Check if enough time has passed to advance to next frame
      if (currentTime - this.lastFrameTime >= frameInterval) {
         this.lastFrameTime = currentTime;
         this.advanceFrame();
      }

      return this.getCurrentTexture();
   }

   /**
    * Advance to the next frame in the current animation
    */
   private advanceFrame(): void {
      const animationSequence = this.animations.get(this.currentAnimation);
      if (!animationSequence) return;

      if (animationSequence.loop) {
         // Loop animation - go back to first frame after last
         this.currentFrame = (this.currentFrame + 1) % animationSequence.frames.length;
      } else {
         // Don't loop, stop at last frame
         if (this.currentFrame < animationSequence.frames.length - 1) {
            this.currentFrame++;
         } else {
            // Animation finished, return to idle
            if (this.currentAnimation !== 'idle') {
               this.setAnimation('idle');
               return;
            }
         }
      }

      this.updateCurrentFrame();
   }

   /**
    * Update the sprite to show the current frame
    */
   private updateCurrentFrame(): void {
      const newTexture = this.getCurrentTexture();
      if (newTexture && this.sprite.texture !== newTexture) {
         this.sprite.texture = newTexture;

         // Maintain sprite dimensions when texture changes
         const currentScaleX = this.sprite.scale.x;
         const currentScaleY = this.sprite.scale.y;

         // Apply the scale again to maintain flipping and sizing
         this.sprite.scale.set(currentScaleX, currentScaleY);
      }
   }

   /**
    * Get the current frame's texture
    */
   private getCurrentTexture(): Texture | null {
      const animationSequence = this.animations.get(this.currentAnimation);
      if (!animationSequence || animationSequence.frames.length === 0) {
         return null;
      }

      const frameIndex = Math.min(this.currentFrame, animationSequence.frames.length - 1);
      return animationSequence.frames[frameIndex]?.texture || null;
   }

   /**
    * Play a specific animation once, then return to a default animation
    */
   public playAnimationOnce(animationName: string, onComplete?: () => void, returnToAnimation: string = 'idle'): void {
      this.setAnimation(animationName);

      const animationSequence = this.animations.get(animationName);
      if (!animationSequence) return;

      // Set up completion check
      const checkCompletion = () => {
         if (this.currentFrame >= animationSequence.frames.length - 1) {
            if (onComplete) onComplete();
            this.setAnimation(returnToAnimation);
         } else {
            setTimeout(checkCompletion, 1000 / animationSequence.frameRate);
         }
      };

      setTimeout(checkCompletion, 1000 / animationSequence.frameRate);
   }

   /**
    * Check if current animation is complete (for non-looping animations)
    */
   public isAnimationComplete(): boolean {
      const animationSequence = this.animations.get(this.currentAnimation);
      if (!animationSequence || animationSequence.loop) {
         return false;
      }

      return this.currentFrame >= animationSequence.frames.length - 1;
   }

   /**
    * Pause or resume animation
    */
   public setAnimationPaused(paused: boolean): void {
      this.isAnimating = !paused;
   }

   /**
    * Get the current animation name
    */
   public getCurrentAnimation(): string {
      return this.currentAnimation;
   }

   /**
    * Get available animations
    */
   public getAvailableAnimations(): string[] {
      return Array.from(this.animations.keys());
   }

   /**
    * Get the render container
    */
   public getContainer(): Container {
      return this.container;
   }

   /**
    * Get the body container (for applying rotations)
    */
   public getBodyContainer(): Container {
      return this.bodyContainer;
   }

   /**
    * Get the gun container (for entities with weapons)
    */
   public getGunContainer(): Container | undefined {
      return this.gunContainer;
   }

   /**
    * Add gun container for entities that have weapons (like players)
    */
   public addGunContainer(): Container {
      if (!this.gunContainer) {
         this.gunContainer = new Container();
         this.container.addChild(this.gunContainer);
      }
      return this.gunContainer;
   }

   /**
    * Get the main sprite
    */
   public getSprite(): Sprite {
      return this.sprite;
   }

   /**
    * Update the entity's position
    */
   public updatePosition(x: number, y: number): void {
      this.container.position.set(x, y);
   }

   /**
    * Update the entity's rotation
    */
   public updateRotation(rotation: number): void {
      this.bodyContainer.rotation = rotation;
   }

   /**
    * Rotate guns (if gun container exists)
    */
   public rotateGuns(angle: number): void {
      if (this.gunContainer) {
         this.gunContainer.rotation = angle;
      }
   }

   /**
    * Get gun rotation (if gun container exists)
    */
   public getGunsRotation(): number {
      return this.gunContainer ? this.gunContainer.rotation : 0;
   }

   /**
    * Get debug information about current animation state
    */
   public getAnimationDebugInfo(): string {
      const animationSequence = this.animations.get(this.currentAnimation);
      return `Animation: ${this.currentAnimation} | Frame: ${this.currentFrame}/${animationSequence?.frames.length || 0} | FPS: ${animationSequence?.frameRate || 0} | Loop: ${animationSequence?.loop || false}`;
   }

   /**
    * Destroy the render component and clean up resources
    */
   public destroy(): void {
      // Stop animation
      this.isAnimating = false;

      // Clear animations
      this.animations.clear();

      // Destroy container and all children
      // if (this.container) {
      //    this.container.destroy({ children: true, texture: false, baseTexture: false });
      // }
   }
}
