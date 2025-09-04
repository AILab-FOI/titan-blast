import { Position } from 'shared/game/Position';
import FrontendGame from '../FrontendGame';
import { Container, Sprite, Texture } from 'pixi.js';
import { Renderable } from './Renderable';
import { AnimationCurves, AnimationCurveType } from '../../../../shared/src/game/animation/AnimationCurves';

export class BulletAnimator implements Renderable {
   private sprite: Sprite;
   private startPos: Position;
   private endPos: Position;
   private startTime: number;
   private duration: number;
   private game: FrontendGame;
   private isDestroyed: boolean = false;
   private animationCurveFunction: (t: number) => number;

   constructor(
      game: FrontendGame,
      texture: Texture,
      parentContainer: Container,
      startPos: Position,
      endPos: Position,
      rotation: number,
      duration: number,
      animationCurve: AnimationCurveType,
      bulletWidth?: number,
      bulletHeight?: number,
   ) {
      this.game = game;
      this.startPos = startPos;
      this.endPos = endPos;
      this.startTime = performance.now();

      this.duration = duration;

      this.animationCurveFunction = AnimationCurves.getCurveFunction(animationCurve);

      // Create the bullet sprite
      this.sprite = new Sprite(texture);
      this.sprite.anchor.set(0.5);
      this.sprite.position.set(startPos.x, startPos.y);
      this.sprite.rotation = rotation;

      // Apply bullet size from gun config with correct orientation
      if (bulletWidth !== undefined && bulletHeight !== undefined) {
         const BULLET_SCALE = 60;
         this.sprite.width = bulletHeight * BULLET_SCALE;
         this.sprite.height = bulletWidth * BULLET_SCALE;
      }

      parentContainer.addChild(this.sprite);
   }

   public update(): void {
      if (this.isDestroyed) return;

      const elapsed = performance.now() - this.startTime;
      const progress = Math.min(elapsed / this.duration, 1);

      const curvedProgress = this.animationCurveFunction(progress);

      const interpolatedPos = {
         x: this.startPos.x + (this.endPos.x - this.startPos.x) * curvedProgress,
         y: this.startPos.y + (this.endPos.y - this.startPos.y) * curvedProgress,
      };

      this.sprite.position.set(interpolatedPos.x, interpolatedPos.y);

      if (progress >= 1) {
         this.destroy();
      }
   }


   public getSprite(): Sprite {
      return this.sprite;
   }

   public destroy(): void {
      if (this.isDestroyed) return;

      this.isDestroyed = true;

      if (this.sprite && this.sprite.parent) {
         this.sprite.parent.removeChild(this.sprite);
         this.sprite.destroy();
      }

      this.game.getRenderManager().removeRenderableObject(this);
   }
}
