import { Container, Sprite, Texture } from 'pixi.js';
import { Position } from 'shared/game/Position';
import { InterpolationState } from './interpolation/InterpolationState';
import { EntityShape } from 'shared/game/PlayerTypes';
import { gameSettings } from 'shared/game/SystemSettings';
import { MathUtil } from 'shared/util/MathUtil';
import { TimeUtil } from 'shared/util/TimeUtil';

export interface ShapeDimensions {
   width?: number;
   height?: number;
   radius?: number;
}

// RenderConfig to pass to RenderComponent
export interface RenderConfig {
   shape: EntityShape;
   dimensions: ShapeDimensions;
}

interface InterpolationTarget {
   startState: InterpolationState;
   endState: InterpolationState;
   startTime: number;
   duration: number;
}

export abstract class RenderComponent {
   sprite!: Sprite;
   container: Container;

   private useInterpolation: boolean;
   private currentTarget: InterpolationTarget | null = null;
   private interpolationDuration = gameSettings.gameUpdateIntervalMillis * 2;

   constructor(
      texture: Texture,
      renderConfig: RenderConfig,
      parentContainer: Container,
      isLocalEntity: boolean = false,
      useInterpolation: boolean = true,
   ) {
      if (isLocalEntity) {
         this.interpolationDuration = gameSettings.gameUpdateIntervalMillis;
      }

      this.useInterpolation = useInterpolation;

      // Create container
      this.container = this.createContainerStructure(texture);
      parentContainer.addChild(this.container);

      // Create sprite
      // this.sprite = new Sprite(texture);
      // this.sprite.anchor.set(0.5);
      // this.container.addChild(this.sprite);

      // Handle different shapes
      this.setupShape(renderConfig);
   }

   protected abstract createContainerStructure(texture: Texture): Container;
   protected abstract setupShape(config: RenderConfig): void;
   public abstract getPosition(): Position;
   public abstract setPosition(position: Position): void;
   public abstract getRotation(): number;
   public abstract setRotation(rotation: number): void;

   private createState(position: Position, rotation: number): InterpolationState {
      return {
         position: { ...position },
         rotation,
         timestamp: TimeUtil.getCurrentTimestamp(),
      };
   }

   /**
    * Update visual state. This is the main method to call in the render loop.
    */
   public update(): void {
      if (!this.useInterpolation || !this.currentTarget) {
         return;
      }

      const currentTime = TimeUtil.getCurrentTimestamp();
      const elapsed = currentTime - this.currentTarget.startTime;

      if (elapsed >= this.currentTarget.duration) {
         // We've reached or passed the target time, snap to final position
         const finalState = this.currentTarget.endState;
         // this.container.position.set(finalState.position.x, finalState.position.y);
         // this.container.rotation = finalState.rotation;
         this.setPosition(finalState.position);
         this.setRotation(finalState.rotation);
         this.currentTarget = null;
         return;
      }

      const alpha = elapsed / this.currentTarget.duration;

      const start = this.currentTarget.startState;
      const end = this.currentTarget.endState;

      const interpolatedPos = {
         x: start.position.x + (end.position.x - start.position.x) * alpha,
         y: start.position.y + (end.position.y - start.position.y) * alpha,
      };

      const deltaAngle = MathUtil.shortestAngleBetween(start.rotation, end.rotation);
      const interpolatedRotation = start.rotation + deltaAngle * alpha;

      this.setPosition(interpolatedPos);
      this.setRotation(interpolatedRotation);
   }

   public updateState(position: Position, rotation: number): void {
      if (!this.useInterpolation) {
         // this.container.position.set(position.x, position.y);
         // this.container.rotation = rotation;
         this.setPosition(position);
         this.setRotation(rotation);
         return;
      }

      // console.log('state updated to', position.x, position.y);
      const newState = this.createState(position, rotation);

      const currentState = this.createState(
         { x: this.getPosition().x, y: this.getPosition().y },
         this.getRotation(),
      );

      this.currentTarget = {
         startState: currentState,
         endState: newState,
         startTime: TimeUtil.getCurrentTimestamp(),
         duration: this.interpolationDuration,
      };
   }

   // public setPosition(position: Position, rotation: number): void {
   //    this.container.position.set(position.x, position.y);
   //    this.container.rotation = rotation;
   // }

   public destroy(): void {
      if (this.container.parent) {
         this.container.parent.removeChild(this.container);
      }

      this.container.destroy({
         children: true,
         texture: true,
         textureSource: false,
         context: false,
      });
   }
}
