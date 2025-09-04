import { HitmarkerManager } from './HitmarkerManager';
import { Container } from 'pixi.js';

export class GameEffectsManager {
   private hitmarkerManager: HitmarkerManager;

   constructor() {
      this.hitmarkerManager = new HitmarkerManager();
   }

   /**
    * Create simple white flash hitmarker on any entity
    */
   public createHitmarker(entityContainer: Container): void {
      this.hitmarkerManager.createHitmarker(entityContainer);
   }

   /**
    * Update all effects
    */
   public update(): void {
      this.hitmarkerManager.update();
   }

   /**
    * Clear all effects
    */
   public clear(): void {
      this.hitmarkerManager.clear();
   }

   /**
    * Cleanup
    */
   public destroy(): void {
      this.hitmarkerManager.destroy();
   }
}
