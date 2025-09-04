// TrailManager.ts
import { Container, Texture } from 'pixi.js';
import { Position } from 'shared/game/Position';
import { RaycastBullet } from './RaycastBullet';

export class TrailManager {
   private effects: RaycastBullet[] = [];

   public createBulletTrail(
      id: string,
      container: Container,
      startPos: Position,
      endPos: Position,
      texture: Texture,
   ): RaycastBullet {
      const effect = new RaycastBullet(id, container, startPos, endPos, texture);
      this.effects.push(effect);
      return effect;
   }

   public update() {
      // Update and remove completed effects
      this.effects = this.effects.filter((effect) => {
         const completed = effect.update();
         if (completed) {
            effect.destroy();
         }
         return !completed;
      });
   }

   public clear() {
      this.effects.forEach((effect) => effect.destroy());
      this.effects = [];
   }
}
