import { RenderComponent, RenderConfig } from './RenderComponent';
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { EntityShape } from 'shared/game/PlayerTypes';
import { Position } from 'shared/game/Position';

export class BasicRenderComponent extends RenderComponent {
   protected createContainerStructure(texture: Texture): Container {
      const container = new Container();
      this.sprite = new Sprite(texture);
      this.sprite.anchor.set(0.5);
      container.addChild(this.sprite);
      return container;
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
      return this.container.rotation;
   }

   public setRotation(rotation: number): void {
      this.container.rotation = rotation;
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
}
