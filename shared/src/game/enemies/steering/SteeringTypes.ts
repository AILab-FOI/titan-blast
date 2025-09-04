import { Position } from '../../Position';
import { BaseEnemy } from '../BaseEnemy';

/**
 * Vector2 utility for steering calculations
 */
export interface Vector2 {
   x: number;
   y: number;
}

/**
 * Context information provided to steering behaviors
 */
export interface SteeringContext {
   enemy: BaseEnemy;
   nearbyEnemies: BaseEnemy[];
   targetPosition: Position | null;
   currentTime: number;
}

/**
 * Interface for individual steering behaviors
 */
export interface ISteeringBehavior {
   readonly name: string;
   readonly enabled: boolean;
   readonly weight: number;

   /**
    * Calculate steering force for this behavior
    * Returns normalized direction vector (magnitude 0-1)
    */
   calculateSteering(context: SteeringContext): Vector2;
}

/**
 * Configuration for separation behavior
 */
export interface SeparationConfig {
   enabled: boolean;
   radius: number; // Detection radius for nearby enemies
   strength: number; // Force multiplier (0.0-2.0)
   maxForce: number; // Maximum force that can be applied
   updateFrequency: number; // Update every N milliseconds
}

/**
 * Default separation configuration
 */
export const DEFAULT_SEPARATION_CONFIG: SeparationConfig = {
   enabled: true,
   radius: 80,
   strength: 0.5,
   maxForce: 5,
   updateFrequency: 100, // Update every 100ms
};
