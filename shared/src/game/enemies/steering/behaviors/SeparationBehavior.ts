import { ISteeringBehavior, SeparationConfig, SteeringContext, Vector2 } from '../SteeringTypes';
import { MathUtil } from '../../../../util/MathUtil';

/**
 * Separation behavior - keeps enemies from clustering too closely
 */
export class SeparationBehavior implements ISteeringBehavior {
   public readonly name = 'separation';

   private config: SeparationConfig;
   private lastUpdateTime: number = 0;
   private cachedSteering: Vector2 = { x: 0, y: 0 };

   constructor(config: SeparationConfig) {
      this.config = { ...config };
   }

   public get enabled(): boolean {
      return this.config.enabled;
   }

   public get weight(): number {
      return this.config.strength;
   }

   /**
    * Calculate separation steering force
    */
   public calculateSteering(context: SteeringContext): Vector2 {
      if (!this.enabled) {
         return { x: 0, y: 0 };
      }

      // Use cached result if update frequency hasn't passed
      const timeSinceUpdate = context.currentTime - this.lastUpdateTime;
      if (timeSinceUpdate < this.config.updateFrequency && this.cachedSteering) {
         return this.cachedSteering;
      }

      const separationForce = this.calculateSeparationForce(context);

      // Cache the result
      this.cachedSteering = separationForce;
      this.lastUpdateTime = context.currentTime;

      return separationForce;
   }

   private calculateSeparationForce(context: SteeringContext): Vector2 {
      const { enemy, nearbyEnemies } = context;
      const separationVector: Vector2 = { x: 0, y: 0 };
      let neighborCount = 0;

      // Find all enemies within separation radius
      for (const other of nearbyEnemies) {
         if (other.id === enemy.id) continue;

         const distance = MathUtil.distance(enemy.position, other.position);

         if (distance < this.config.radius && distance > 0) {
            // Calculate direction away from other enemy
            const awayX = enemy.position.x - other.position.x;
            const awayY = enemy.position.y - other.position.y;

            // Weight by inverse distance (closer = stronger repulsion)
            const weight = (this.config.radius - distance) / this.config.radius;

            separationVector.x += (awayX / distance) * weight;
            separationVector.y += (awayY / distance) * weight;
            neighborCount++;
         }
      }

      // Average the separation vector
      if (neighborCount > 0) {
         separationVector.x /= neighborCount;
         separationVector.y /= neighborCount;

         // Normalize and apply strength
         const magnitude = Math.sqrt(separationVector.x ** 2 + separationVector.y ** 2);
         if (magnitude > 0) {
            const normalizedX = separationVector.x / magnitude;
            const normalizedY = separationVector.y / magnitude;

            // Apply strength but cap at maxForce
            const force = Math.min(magnitude * this.config.strength, this.config.maxForce);

            return {
               x: normalizedX * force,
               y: normalizedY * force,
            };
         }
      }

      return { x: 0, y: 0 };
   }

   /**
    * Update configuration at runtime
    */
   public updateConfig(newConfig: Partial<SeparationConfig>): void {
      this.config = { ...this.config, ...newConfig };
   }
}
