// client/src/game/rendering/interpolation/InterpolationComponent.ts

import { Position } from 'shared/game/Position';
import { MathUtil } from 'shared/util/MathUtil';
import { TimeUtil } from 'shared/util/TimeUtil';
import { gameSettings } from 'shared/game/SystemSettings';

export interface InterpolationState {
   position: Position;
   rotation: number;
   timestamp: number;
}

export interface InterpolationTarget {
   startState: InterpolationState;
   endState: InterpolationState;
   startTime: number;
   duration: number;
}

export interface InterpolatedEntity {
   /**
    * Called when interpolated values are calculated
    */
   onInterpolatedUpdate(position: Position, rotation: number): void;

   /**
    * Get current position for interpolation start state
    */
   getCurrentPosition(): Position;

   /**
    * Get current rotation for interpolation start state
    */
   getCurrentRotation(): number;
}

/**
 * Generic interpolation component that can be attached to any entity
 * Provides smooth movement between server updates
 */
export class InterpolationComponent {
   private entity: InterpolatedEntity;
   private currentTarget: InterpolationTarget | null = null;
   private interpolationDuration: number;
   private useInterpolation: boolean;

   constructor(entity: InterpolatedEntity, useInterpolation: boolean = true, customDuration?: number) {
      this.entity = entity;
      this.useInterpolation = useInterpolation;
      this.interpolationDuration = customDuration || gameSettings.gameUpdateIntervalMillis * 3;
   }

   /**
    * Update interpolation (called every render frame)
    */
   public update(): void {
      if (!this.useInterpolation || !this.currentTarget) {
         return;
      }

      const currentTime = TimeUtil.getCurrentTimestamp();
      const elapsed = currentTime - this.currentTarget.startTime;

      if (elapsed >= this.currentTarget.duration) {
         // Interpolation complete - snap to final position
         const finalState = this.currentTarget.endState;
         this.entity.onInterpolatedUpdate(finalState.position, finalState.rotation);
         this.currentTarget = null;
         return;
      }

      // Calculate interpolation alpha (0 to 1)
      const alpha = elapsed / this.currentTarget.duration;

      // Interpolate position
      const start = this.currentTarget.startState;
      const end = this.currentTarget.endState;

      const interpolatedPos: Position = {
         x: start.position.x + (end.position.x - start.position.x) * alpha,
         y: start.position.y + (end.position.y - start.position.y) * alpha,
      };

      // Interpolate rotation (handle wrapping)
      const deltaAngle = MathUtil.shortestAngleBetween(start.rotation, end.rotation);
      const interpolatedRotation = start.rotation + deltaAngle * alpha;

      // Apply interpolated values
      this.entity.onInterpolatedUpdate(interpolatedPos, interpolatedRotation);
   }

   /**
    * Set new target state for interpolation
    */
   public updateState(newPosition: Position, newRotation: number): void {
      if (!this.useInterpolation) {
         // No interpolation - apply immediately
         this.entity.onInterpolatedUpdate(newPosition, newRotation);
         return;
      }

      const newState: InterpolationState = {
         position: { ...newPosition },
         rotation: newRotation,
         timestamp: TimeUtil.getCurrentTimestamp(),
      };

      const currentState: InterpolationState = {
         position: this.entity.getCurrentPosition(),
         rotation: this.entity.getCurrentRotation(),
         timestamp: TimeUtil.getCurrentTimestamp(),
      };

      this.currentTarget = {
         startState: currentState,
         endState: newState,
         startTime: TimeUtil.getCurrentTimestamp(),
         duration: this.interpolationDuration,
      };
   }

   /**
    * Check if currently interpolating
    */
   public isInterpolating(): boolean {
      return this.currentTarget !== null;
   }

   /**
    * Force stop interpolation and snap to position
    */
   public stopInterpolation(finalPosition?: Position, finalRotation?: number): void {
      if (finalPosition !== undefined && finalRotation !== undefined) {
         this.entity.onInterpolatedUpdate(finalPosition, finalRotation);
      }
      this.currentTarget = null;
   }

   /**
    * Set interpolation duration
    */
   public setInterpolationDuration(duration: number): void {
      this.interpolationDuration = duration;
   }

   /**
    * Enable or disable interpolation
    */
   public setInterpolationEnabled(enabled: boolean): void {
      this.useInterpolation = enabled;
      if (!enabled) {
         this.currentTarget = null;
      }
   }
}
