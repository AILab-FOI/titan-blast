import { Position } from '../game/Position';

export class MathUtil {
   /**
    * Calculate Euclidean distance between two positions
    */
   public static distance(pos1: Position, pos2: Position): number {
      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      return Math.sqrt(dx * dx + dy * dy);
   }

   /**
    * Calculate squared distance (faster when you only need to compare distances)
    */
   public static distanceSquared(pos1: Position, pos2: Position): number {
      const dx = pos1.x - pos2.x;
      const dy = pos1.y - pos2.y;
      return dx * dx + dy * dy;
   }

   public static radiansToDegrees(radians: number): number {
      return radians * (180 / Math.PI);
   }

   public static degreesToRadians(degrees: number): number {
      return degrees * (Math.PI / 180);
   }

   public static normalizeAngle(angle: number): number {
      // Normalize angle to [-π, π]
      return angle - 2 * Math.PI * Math.floor((angle + Math.PI) / (2 * Math.PI));
   }

   public static shortestAngleBetween(start: number, end: number): number {
      // Returns the shortest angular distance between two angles
      const delta = end - start;
      return MathUtil.normalizeAngle(delta);
   }

   public static mulberry32(seed: number) {
      return function () {
         seed |= 0;
         seed = (seed + 0x6d2b79f5) | 0;
         let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
         t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
         return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
   }

   public static hashStringToNumber(str: string): number {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
         hash = (hash << 5) - hash + str.charCodeAt(i);
         hash |= 0; // Convert to 32-bit integer
      }
      return hash;
   }

   /**
    * Linear interpolation between two values
    */
   public static lerp(a: number, b: number, t: number): number {
      return a + (b - a) * t;
   }

   /**
    * Clamp a value between min and max
    */
   public static clamp(value: number, min: number, max: number): number {
      return Math.min(Math.max(value, min), max);
   }
}
