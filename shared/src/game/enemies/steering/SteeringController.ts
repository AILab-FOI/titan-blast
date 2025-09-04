import { ISteeringBehavior, SteeringContext, Vector2 } from './SteeringTypes';
import { BaseEnemy } from '../BaseEnemy';
import { Position } from '../../Position';

/**
 * Manages and coordinates multiple steering behaviors for an enemy
 */
export class SteeringController {
   private behaviors: Map<string, ISteeringBehavior> = new Map();
   private enabled: boolean = true;

   /**
    * Add a steering behavior
    */
   public addBehavior(behavior: ISteeringBehavior): void {
      this.behaviors.set(behavior.name, behavior);
   }

   /**
    * Remove a steering behavior
    */
   public removeBehavior(name: string): void {
      this.behaviors.delete(name);
   }

   /**
    * Get a specific behavior
    */
   public getBehavior<T extends ISteeringBehavior>(name: string): T | undefined {
      return this.behaviors.get(name) as T;
   }

   /**
    * Calculate combined steering force from all enabled behaviors
    */
   public calculateSteering(
      enemy: BaseEnemy,
      nearbyEnemies: BaseEnemy[],
      targetPosition: Position | null,
      currentTime: number,
   ): Vector2 {
      if (!this.enabled || this.behaviors.size === 0) {
         return { x: 0, y: 0 };
      }

      const context: SteeringContext = {
         enemy,
         nearbyEnemies,
         targetPosition,
         currentTime,
      };

      const combinedSteering: Vector2 = { x: 0, y: 0 };
      let totalWeight = 0;

      // Calculate weighted sum of all enabled behaviors
      for (const behavior of this.behaviors.values()) {
         if (!behavior.enabled) continue;

         const steering = behavior.calculateSteering(context);
         const weight = behavior.weight;

         combinedSteering.x += steering.x * weight;
         combinedSteering.y += steering.y * weight;
         totalWeight += weight;
      }

      // Normalize by total weight
      if (totalWeight > 0) {
         combinedSteering.x /= totalWeight;
         combinedSteering.y /= totalWeight;
      }

      return combinedSteering;
   }

   /**
    * Enable/disable all steering behaviors
    */
   public setEnabled(enabled: boolean): void {
      this.enabled = enabled;
   }

   /**
    * Check if steering is enabled
    */
   public isEnabled(): boolean {
      return this.enabled;
   }
}
