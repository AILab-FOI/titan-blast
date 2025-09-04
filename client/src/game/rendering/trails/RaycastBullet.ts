import { TrailConfig, TrailEffect } from './TrailEffect';
import { Container, Sprite, Texture } from 'pixi.js';
import { Position } from 'shared/game/Position';

export class RaycastBullet extends TrailEffect {
   private sprite: Sprite;
   public readonly id: string;

   static readonly DEFAULT_CONFIG: TrailConfig = {
      segmentCount: 10,
      fadeSpeed: 0.1,
      startWidth: 4,
      endWidth: 1,
      color: 0xffff00,
      maxAlpha: 0.8,
   };

   constructor(
      id: string,
      container: Container,
      startPos: Position,
      endPos: Position,
      texture: Texture,
      config: Partial<TrailConfig> = {},
   ) {
      const finalConfig = { ...RaycastBullet.DEFAULT_CONFIG, ...config };
      super(container, finalConfig, startPos, endPos, 100); // 100ms duration

      this.id = id;

      // Setup bullet sprite
      this.sprite = new Sprite(texture);
      this.sprite.anchor.set(0.5);
      this.container.addChild(this.sprite);

      // Set initial rotation
      const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x);
      this.sprite.rotation = angle;
      this.sprite.position.set(startPos.x, startPos.y);
   }

   public override update(): boolean {
      const complete = super.update();

      // Move bullet sprite to latest position
      if (this.segments.length > 0) {
         this.sprite.position.set(this.segments[0].position.x, this.segments[0].position.y);
      }

      if (complete) {
         this.destroy();
      }

      return complete;
   }

   public override destroy() {
      super.destroy();
      this.container.removeChild(this.sprite);
      this.sprite.destroy();
   }
}
