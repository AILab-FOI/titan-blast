// client/src/game/rendering/animation/AnimationManager.ts

import { Texture } from 'pixi.js';
import { AnimationState } from 'shared/game/PlayerTypes';

export interface AnimationFrame {
   texture: Texture;
   label: string;
}

export interface AnimationSequence {
   state: AnimationState;
   frames: AnimationFrame[];
   frameRate: number;
   loop: boolean;
}

export interface AnimationFrameRates {
   [AnimationState.IDLE]?: number;
   [AnimationState.MOVE]?: number;
   [AnimationState.DEATH]?: number;
}

/**
 * Manages character animations by organizing textures into animation sequences
 */
export class AnimationManager {
   private animations: Map<AnimationState, AnimationSequence> = new Map();
   private currentAnimation: AnimationState = AnimationState.IDLE;
   private currentFrame: number = 0;
   private lastFrameTime: number = 0;

   constructor(textures: Record<string, Texture>, customFrameRates?: AnimationFrameRates) {
      this.loadAnimations(textures, customFrameRates);
   }

   /**
    * Load animations from texture collection
    */
   private loadAnimations(textures: Record<string, Texture>, customFrameRates?: AnimationFrameRates): void {
      // Group textures by animation state
      const animationGroups: Record<string, AnimationFrame[]> = {};

      for (const [textureName, texture] of Object.entries(textures)) {
         // Skip textures that don't follow the animation naming convention
         if (!textureName.includes('_')) continue;

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
         const animationState = this.getAnimationStateFromName(animationName);
         if (!animationState) continue;

         // Sort frames by their numeric suffix
         frames.sort((a, b) => {
            // Handle potentially undefined labels with fallback
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
         const frameRate = customFrameRates?.[animationState] || this.getDefaultFrameRate(animationState);
         const loop = animationState !== AnimationState.DEATH; // Death animation shouldn't loop

         const sequence: AnimationSequence = {
            state: animationState,
            frames,
            frameRate,
            loop,
         };

         this.animations.set(animationState, sequence);
         // console.log(`Loaded ${animationState} animation with ${frames.length} frames at ${frameRate} FPS`);
      }

      // Ensure we have at least an idle animation
      if (!this.animations.has(AnimationState.IDLE)) {
         // console.warn('No idle animation found - animations may not work correctly');
      }
   }

   /**
    * Convert animation name to AnimationState enum
    */
   private getAnimationStateFromName(name: string): AnimationState | null {
      switch (name.toLowerCase()) {
         case 'idle':
            return AnimationState.IDLE;
         case 'moving':
         case 'walk':
         case 'run':
         case 'move':
            return AnimationState.MOVE;
         case 'death':
         case 'die':
            return AnimationState.DEATH;
         default:
            console.warn(`Unknown animation state: ${name}`);
            return null;
      }
   }

   /**
    * Get default frame rate for animation state
    */
   private getDefaultFrameRate(state: AnimationState): number {
      switch (state) {
         case AnimationState.IDLE:
            return 2; // Slow idle animation
         case AnimationState.MOVE:
            return 8; // Moderate moving animation
         case AnimationState.DEATH:
            return 6; // Moderate death animation
         default:
            return 4;
      }
   }

   /**
    * Play a specific animation
    */
   public playAnimation(state: AnimationState): void {
      if (this.currentAnimation === state) return;

      const animation = this.animations.get(state);
      if (!animation) {
         console.warn(`Animation ${state} not found`);
         return;
      }

      this.currentAnimation = state;
      this.currentFrame = 0;
      this.lastFrameTime = performance.now();
   }

   /**
    * Update animation and return current texture
    */
   public update(): Texture | null {
      const animation = this.animations.get(this.currentAnimation);
      if (!animation || animation.frames.length === 0) {
         return null;
      }

      const currentTime = performance.now();
      const deltaTime = currentTime - this.lastFrameTime;
      const frameDuration = 1000 / animation.frameRate;

      // Check if it's time to advance to the next frame
      if (deltaTime >= frameDuration) {
         this.currentFrame++;

         // Handle loop or stop at end
         if (this.currentFrame >= animation.frames.length) {
            if (animation.loop) {
               this.currentFrame = 0;
            } else {
               this.currentFrame = animation.frames.length - 1;
            }
         }

         this.lastFrameTime = currentTime;
      }

      return animation.frames[this.currentFrame]?.texture || null;
   }

   /**
    * Get current animation state
    */
   public getCurrentAnimation(): AnimationState {
      return this.currentAnimation;
   }

   /**
    * Check if current animation is complete (only relevant for non-looping animations)
    */
   public isAnimationComplete(): boolean {
      const animation = this.animations.get(this.currentAnimation);
      if (!animation || animation.loop) {
         return false;
      }

      return this.currentFrame >= animation.frames.length - 1;
   }

   /**
    * Get all available animation states
    */
   public getAvailableAnimations(): AnimationState[] {
      return Array.from(this.animations.keys());
   }

   /**
    * Reset current animation to frame 0
    */
   public resetCurrentAnimation(): void {
      this.currentFrame = 0;
      this.lastFrameTime = performance.now();
   }
}
