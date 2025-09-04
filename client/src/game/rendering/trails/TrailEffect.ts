import { Position } from 'shared/game/Position';
import { Container, Graphics } from 'pixi.js';

interface TrailSegment {
   position: Position;
   alpha: number;
   width: number;
}

export interface TrailConfig {
   segmentCount: number; // Number of segments in trail
   fadeSpeed: number; // How quickly trail fades per frame (0-1)
   startWidth: number; // Initial width
   endWidth: number; // Final width
   color: number; // Color of trail
   maxAlpha: number; // Maximum alpha value
}

export abstract class TrailEffect {
   protected segments: TrailSegment[] = [];
   protected trail: Graphics;
   protected startPos: Position;
   protected endPos: Position;
   protected progress: number = 0;
   protected startTime: number;

   constructor(
      protected container: Container,
      protected config: TrailConfig,
      startPos: Position,
      endPos: Position,
      protected duration: number,
   ) {
      this.startPos = startPos;
      this.endPos = endPos;
      this.startTime = performance.now();

      this.trail = new Graphics();
      this.container.addChild(this.trail);

      this.initializeSegments();
   }

   protected initializeSegments() {
      for (let i = 0; i < this.config.segmentCount; i++) {
         const progress = i / (this.config.segmentCount - 1);
         this.segments.push({
            position: { ...this.startPos },
            alpha: this.config.maxAlpha * (1 - progress), // Newer segments = higher alpha
            width:
               this.config.startWidth + (this.config.endWidth - this.config.startWidth) * progress,
         });
      }
   }

   public update(): boolean {
      const elapsed = performance.now() - this.startTime;
      this.progress = Math.min(elapsed / this.duration, 1);

      const currentPos = {
         x: this.startPos.x + (this.endPos.x - this.startPos.x) * this.progress,
         y: this.startPos.y + (this.endPos.y - this.startPos.y) * this.progress,
      };

      this.updateTrail(currentPos);
      this.fadeTrail();
      this.drawTrail();

      return this.progress >= 1;
   }

   protected updateTrail(currentPos: Position) {
      for (let i = this.segments.length - 1; i > 0; i--) {
         this.segments[i].position = { ...this.segments[i - 1].position };
      }

      this.segments[0].position = { ...currentPos };
   }

   protected fadeTrail() {
      // Reduce alpha and width gradually over time
      for (let i = 0; i < this.segments.length; i++) {
         this.segments[i].alpha = Math.max(0, this.segments[i].alpha - this.config.fadeSpeed);
         this.segments[i].width = Math.max(this.config.endWidth, this.segments[i].width * 0.95);
      }
   }

   protected drawTrail() {
      this.trail.clear();

      for (let i = 0; i < this.segments.length - 1; i++) {
         const current = this.segments[i];
         const next = this.segments[i + 1];

         this.trail.lineStyle(current.width, this.config.color, current.alpha);
         this.trail.moveTo(current.position.x, current.position.y);
         this.trail.lineTo(next.position.x, next.position.y);
      }
   }

   public destroy() {
      this.container.removeChild(this.trail);
      this.trail.destroy();
   }
}
