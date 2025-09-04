// client/src/game/effects/HitmarkerManager.ts
import { ColorMatrixFilter, Container } from 'pixi.js';

class SimpleHitmarker {
   private filter!: ColorMatrixFilter;
   public targetContainer: Container; // Make public so manager can access it
   private startTime: number;
   private duration: number;
   private originalFilters: any[];

   constructor(targetContainer: Container, duration: number = 150) {
      this.targetContainer = targetContainer;
      this.duration = duration;
      this.startTime = performance.now();

      // Store original filters to restore later
      this.originalFilters = this.targetContainer.filters ? [...this.targetContainer.filters] : [];

      // Create and apply the white flash filter
      this.setupHitmarkerFilter();
   }

   private setupHitmarkerFilter(): void {
      this.filter = new ColorMatrixFilter();

      // White flash - brighten all colors
      this.filter.matrix = [
         1.5,
         1.5,
         1.5,
         0,
         0.3,
         1.5,
         1.5,
         1.5,
         0,
         0.3,
         1.5,
         1.5,
         1.5,
         0,
         0.3,
         0,
         0,
         0,
         1,
         0,
      ];

      // Apply the filter to the target container
      const currentFilters = this.targetContainer.filters || [];
      this.targetContainer.filters = [...currentFilters, this.filter];
   }

   public update(): boolean {
      const elapsed = performance.now() - this.startTime;
      const progress = elapsed / this.duration;

      if (progress >= 1) {
         // Animation complete - remove filter
         this.removeFilter();
         return true;
      }

      // Fade out the white flash
      const intensity = 1 - progress;
      const brightness = 1 + 0.5 * intensity;
      const white = 0.3 * intensity;

      this.filter.matrix = [
         brightness,
         brightness,
         brightness,
         0,
         white,
         brightness,
         brightness,
         brightness,
         0,
         white,
         brightness,
         brightness,
         brightness,
         0,
         white,
         0,
         0,
         0,
         1,
         0,
      ];

      return false;
   }

   private removeFilter(): void {
      if (this.targetContainer.filters) {
         // Remove our filter and restore original filters
         this.targetContainer.filters = this.originalFilters;
      }
   }

   public destroy(): void {
      this.removeFilter();
   }
}

export class HitmarkerManager {
   private hitmarkers: SimpleHitmarker[] = [];
   private activeContainers = new Set<Container>(); // Track containers with active hitmarkers

   constructor() {
      // No need for a container since we're applying filters directly to entities
   }

   /**
    * Create a simple white flash hitmarker on an entity's container
    */
   public createHitmarker(entityContainer: Container): void {
      // Check if this container already has an active hitmarker
      if (this.activeContainers.has(entityContainer)) {
         // Cancel existing hitmarker for this container
         this.cancelHitmarkerForContainer(entityContainer);
      }

      const hitmarker = new SimpleHitmarker(entityContainer, 80);
      this.hitmarkers.push(hitmarker);
      this.activeContainers.add(entityContainer);
   }

   /**
    * Cancel any existing hitmarker for a specific container
    */
   private cancelHitmarkerForContainer(container: Container): void {
      // Find and remove hitmarkers for this container
      this.hitmarkers = this.hitmarkers.filter((hitmarker) => {
         if (hitmarker.targetContainer === container) {
            hitmarker.destroy();
            return false;
         }
         return true;
      });
      this.activeContainers.delete(container);
   }

   /**
    * Update all active hitmarkers
    */
   public update(): void {
      this.hitmarkers = this.hitmarkers.filter((hitmarker) => {
         const completed = hitmarker.update();
         if (completed) {
            // Remove from active containers tracking
            this.activeContainers.delete(hitmarker.targetContainer);
            hitmarker.destroy();
         }
         return !completed;
      });
   }

   /**
    * Clear all hitmarkers
    */
   public clear(): void {
      this.hitmarkers.forEach((hitmarker) => hitmarker.destroy());
      this.hitmarkers = [];
      this.activeContainers.clear(); // Clear tracking set
   }

   /**
    * Cleanup
    */
   public destroy(): void {
      this.clear();
   }
}
