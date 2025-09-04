import { Position } from 'shared/game/Position';

export class InterpolationUtils {
   /**
    * Linear interpolation between two numbers
    */
   public static lerp(start: number, end: number, t: number): number {
      return start + (end - start) * t;
   }

   /**
    * Smoothstep interpolation for more natural movement
    */
   public static smoothStep(t: number): number {
      return t * t * (3 - 2 * t);
   }

   /**
    * Interpolate between two positions using smoothstep
    */
   public static interpolatePosition(start: Position, end: Position, t: number): Position {
      const smoothT = InterpolationUtils.smoothStep(t);
      return {
         x: InterpolationUtils.lerp(start.x, end.x, smoothT),
         y: InterpolationUtils.lerp(start.y, end.y, smoothT),
      };
   }

   /**
    * Calculate smooth reconciliation factor
    */
   public static calculateReconciliationFactor(
      startTime: number,
      duration: number,
      currentTime: number = performance.now(),
   ): number {
      const progress = (currentTime - startTime) / duration;
      return InterpolationUtils.smoothStep(Math.min(1, Math.max(0, progress)));
   }
}
