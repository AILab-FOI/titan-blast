import { Container, MeshRope, Point, Sprite, Texture } from 'pixi.js';
import FrontendGame from '../../FrontendGame';
import { Renderable } from '../Renderable';
import { Position } from 'shared/game/Position';

export interface BulletTrailConfig {
   historySize: number;
   ropeSize: number;
   texture: Texture;
   fadeSpeed: number;
   maxOpacity: number;
   lightnessAdjust: number;
   width: number;
}

export class BulletTrail implements Renderable {
   private rope: MeshRope;
   private points: Point[] = [];
   private bulletColor: number;
   private isFadingOut = false;
   private segmentAlphas: number[] = [];

   private trailStartPos: Position;
   private trailEndPos: Position;
   private bulletProgress: number = 0;
   private totalPathLength: number;

   private bulletDestroyCheckCount: number = 0;
   private maxDestroyChecks: number = 5;

   constructor(
      private container: Container,
      private game: FrontendGame,
      private bulletSprite: Sprite,
      private config: BulletTrailConfig,
      startPos: Position,
      endPos: Position,
   ) {
      this.bulletColor = this.extractBulletColor(bulletSprite);
      this.trailStartPos = { ...startPos };
      this.trailEndPos = { ...endPos };

      // Calculate total path length
      this.totalPathLength = Math.sqrt(
         Math.pow(this.trailEndPos.x - this.trailStartPos.x, 2) +
            Math.pow(this.trailEndPos.y - this.trailStartPos.y, 2),
      );

      // Initialize trail points
      for (let i = 0; i < this.config.ropeSize; i++) {
         this.points.push(new Point(startPos.x, startPos.y));
         this.segmentAlphas.push(0);
      }

      this.rope = new MeshRope({
         texture: this.config.texture,
         points: this.points,
         textureScale: this.config.width / this.config.texture.width,
      });

      this.rope.tint = this.bulletColor;
      this.rope.alpha = 0;
      this.container.addChild(this.rope);
   }

   private extractBulletColor(sprite: Sprite): number {
      let baseColor = sprite.tint;
      if (baseColor === 0xffffff) {
         baseColor = 0x4080ff;
      }

      let r = (baseColor >> 16) & 0xff;
      let g = (baseColor >> 8) & 0xff;
      let b = baseColor & 0xff;

      const brightnessMultiplier = 1 + this.config.lightnessAdjust;
      r = Math.min(255, Math.floor(r * brightnessMultiplier));
      g = Math.min(255, Math.floor(g * brightnessMultiplier));
      b = Math.min(255, Math.floor(b * brightnessMultiplier));

      return (r << 16) | (g << 8) | b;
   }

   public update(): void {
      const bulletExists = this.bulletSprite && !this.bulletSprite.destroyed && this.bulletSprite.parent;

      if (!bulletExists) {
         this.bulletDestroyCheckCount++;

         // Only start fading after we're sure the bullet is gone
         if (this.bulletDestroyCheckCount >= this.maxDestroyChecks && !this.isFadingOut) {
            this.startFading();
         }
      } else {
         // Reset counter if bullet is still alive
         this.bulletDestroyCheckCount = 0;
      }

      if (bulletExists && !this.isFadingOut) {
         this.bulletProgress = this.calculateBulletProgress();

         this.updateTrailAlongPath();

         // Build up trail opacity
         this.buildUpTrail();
      } else if (this.isFadingOut) {
         // Handle trail fadeout
         this.fadeOutTrail();
      }

      // Update overall rope visibility
      const maxAlpha = Math.max(...this.segmentAlphas);
      this.rope.alpha = maxAlpha;
   }

   private calculateBulletProgress(): number {
      if (!this.bulletSprite || this.totalPathLength === 0) return 0;

      const currentBulletX = this.bulletSprite.x;
      const currentBulletY = this.bulletSprite.y;

      // Calculate how far bullet has traveled from start
      const bulletTravelDistance = Math.sqrt(
         Math.pow(currentBulletX - this.trailStartPos.x, 2) + Math.pow(currentBulletY - this.trailStartPos.y, 2),
      );

      // Return progress as ratio (0 to 1+)
      return bulletTravelDistance / this.totalPathLength;
   }

   private updateTrailAlongPath(): void {
      for (let i = 0; i < this.config.ropeSize; i++) {
         const segmentRatio = i / (this.config.ropeSize - 1);
         const point = this.points[i];

         // Only show trail up to where bullet has traveled
         const effectiveProgress = Math.min(segmentRatio, this.bulletProgress);

         if (effectiveProgress >= 0) {
            // Interpolate position along the fixed path from start toward end
            point.x = this.trailStartPos.x + (this.trailEndPos.x - this.trailStartPos.x) * effectiveProgress;
            point.y = this.trailStartPos.y + (this.trailEndPos.y - this.trailStartPos.y) * effectiveProgress;
         } else {
            // Keep at start position
            point.x = this.trailStartPos.x;
            point.y = this.trailStartPos.y;
         }
      }
   }

   private buildUpTrail(): void {
      for (let i = 0; i < this.segmentAlphas.length; i++) {
         const segmentRatio = i / (this.config.ropeSize - 1);

         // Only show segments where bullet has passed or is currently at
         if (segmentRatio <= this.bulletProgress) {
            if (this.segmentAlphas[i] < this.config.maxOpacity) {
               this.segmentAlphas[i] = Math.min(this.config.maxOpacity, this.segmentAlphas[i] + 0.15);
            }
         }
      }
   }

   private fadeOutTrail(): void {
      let anyVisible = false;

      for (let i = 0; i < this.segmentAlphas.length; i++) {
         if (this.segmentAlphas[i] > 0) {
            const segmentProgress = i / (this.config.ropeSize - 1);

            const fadeMultiplier = 1 + (1 - segmentProgress) * 1.5;
            this.segmentAlphas[i] = Math.max(0, this.segmentAlphas[i] - this.config.fadeSpeed * fadeMultiplier);

            if (this.segmentAlphas[i] > 0) {
               anyVisible = true;
            }
         }
      }

      // Destroy trail when completely faded
      if (!anyVisible) {
         this.destroy();
      }
   }

   public startFading(): void {
      if (!this.isFadingOut) {
         this.isFadingOut = true;
      }
   }

   public destroy(): void {
      if (this.rope && this.rope.parent) {
         this.container.removeChild(this.rope);
         this.rope.destroy();
      }
      this.game.getRenderManager().removeRenderableObject(this);
   }
}
