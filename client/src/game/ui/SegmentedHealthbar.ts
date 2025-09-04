// client/src/game/ui/SegmentedHealthbar.ts

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Position } from 'shared/game/Position';

export interface HealthbarConfig {
   /** Maximum health value */
   maxHealth: number;
   /** Current health value */
   currentHealth: number;
   /** Health per segment (determines number of segments) */
   healthPerSegment?: number; // Optional, will auto-calculate if not provided
   /** Width of each segment in pixels */
   segmentWidth?: number;
   /** Height of the healthbar in pixels */
   height?: number;
   /** Gap between segments in pixels */
   segmentGap?: number;
   /** Colors for different health states */
   colors?: {
      full?: number; // Color when segment is full
      damaged?: number; // Color when segment is partially damaged
      empty?: number; // Color when segment is empty
      background?: number; // Background/border color
   };
   /** Whether to show health numbers */
   showNumbers?: boolean;
   /** Offset from entity center */
   offset?: Position;
}

export interface EntityDimensions {
   width: number;
   height: number;
}

export function calculateHealthbarOffset(entityDimensions: EntityDimensions): Position {
   const entityHeight = entityDimensions.height;

   // Healthbar configuration constants
   const healthbarHeight = 6; // Default healthbar height
   const baseGap = 8; // Base gap between entity top and healthbar bottom

   // Scale gap slightly based on entity size for better visual proportions
   // Larger entities get slightly more spacing to maintain visual balance
   const heightBasedGap = Math.max(0, (entityHeight - 60) * 0.1);
   const finalGap = baseGap + heightBasedGap;

   // Calculate Y offset: place healthbar above the entity with consistent spacing
   // Formula: -(half entity height) - gap - healthbar height
   const yOffset = -(entityHeight / 2) - finalGap - healthbarHeight;

   return {
      x: 0, // Keep centered horizontally
      y: Math.round(yOffset), // Round to avoid sub-pixel positioning
   };
}

export class SegmentedHealthbar {
   private container: Container;
   private segments: Graphics[] = [];
   private backgroundBar: Graphics;
   private healthText?: Text;
   private config: Required<HealthbarConfig>;
   private isVisible: boolean = false;

   constructor(config: HealthbarConfig, entityContainer: Container) {
      // Apply defaults to config
      this.config = this.applyDefaults(config);

      this.container = new Container();
      // Position the healthbar relative to entity center
      this.container.x = this.config.offset!.x;
      this.container.y = this.config.offset!.y;

      entityContainer.addChild(this.container);

      // Create background bar
      this.backgroundBar = new Graphics();
      this.container.addChild(this.backgroundBar);

      // Create health text if enabled
      if (this.config.showNumbers) {
         this.healthText = new Text(
            '',
            new TextStyle({
               fontFamily: 'Arial',
               fontSize: 10,
               fill: 0xffffff,
               stroke: { color: 0x000000, width: 1 },
            }),
         );
         this.healthText.anchor.set(0.5, 0);
         this.container.addChild(this.healthText);
      }

      this.createSegments();
      this.updateDisplay();
   }

   /**
    * Apply default values to config
    */
   private applyDefaults(config: HealthbarConfig): Required<HealthbarConfig> {
      // Auto-calculate health per segment based on max health if not provided
      let healthPerSegment = config.healthPerSegment;
      if (!healthPerSegment) {
         healthPerSegment = 50; // Fixed 50 health per segment
      }

      return {
         maxHealth: config.maxHealth,
         currentHealth: config.currentHealth,
         healthPerSegment,
         segmentWidth: config.segmentWidth ?? 10,
         height: config.height ?? 6,
         segmentGap: config.segmentGap ?? 2,
         colors: {
            full: config.colors?.full ?? 0x00ff00, // Green
            damaged: config.colors?.damaged ?? 0xffaa00, // Orange
            empty: config.colors?.empty ?? 0xff0000, // Red
            background: config.colors?.background ?? 0x333333, // Dark gray
         },
         showNumbers: config.showNumbers ?? false,
         offset: config.offset ?? { x: 0, y: -35 },
      };
   }

   /**
    * Create the individual health segments
    */
   private createSegments(): void {
      // Clear existing segments
      this.segments.forEach((segment) => {
         this.container.removeChild(segment);
      });
      this.segments = [];

      const segmentCount = Math.ceil(this.config.maxHealth / this.config.healthPerSegment);
      const totalWidth = segmentCount * this.config.segmentWidth + (segmentCount - 1) * this.config.segmentGap;

      for (let i = 0; i < segmentCount; i++) {
         const segment = new Graphics();
         const x = i * (this.config.segmentWidth + this.config.segmentGap) - totalWidth / 2;

         segment.x = x;
         segment.y = 0;

         this.segments.push(segment);
         this.container.addChild(segment);
      }

      // Draw background using v8+ API
      this.backgroundBar.clear();
      this.backgroundBar
         .rect(-totalWidth / 2 - 1, -1, totalWidth + 2, this.config.height + 2)
         .stroke({ width: 1, color: this.config.colors.background });
   }

   /**
    * Update the healthbar display based on current health
    */
   public updateHealth(currentHealth: number, maxHealth?: number): void {
      if (maxHealth !== undefined && maxHealth !== this.config.maxHealth) {
         this.config.maxHealth = maxHealth;
         this.createSegments(); // Recreate segments if max health changed
      }

      this.config.currentHealth = Math.max(0, currentHealth);
      this.updateDisplay();
   }

   /**
    * Update the visual display of segments
    */
   private updateDisplay(): void {
      const isAtFullHealth = this.config.currentHealth >= this.config.maxHealth;
      // Only show healthbar if damaged (not at full health)
      this.setVisible(!isAtFullHealth);

      if (!this.isVisible) {
         return;
      }

      let remainingHealth = this.config.currentHealth;

      this.segments.forEach((segment, index) => {
         segment.clear();

         const segmentMaxHealth = Math.min(
            this.config.healthPerSegment,
            this.config.maxHealth - index * this.config.healthPerSegment,
         );
         const segmentCurrentHealth = Math.min(remainingHealth, segmentMaxHealth);

         // Determine segment color
         let segmentColor: number | undefined;
         if (segmentCurrentHealth <= 0) {
            segmentColor = this.config.colors.empty;
         } else if (segmentCurrentHealth >= segmentMaxHealth) {
            segmentColor = this.config.colors.full;
         } else {
            segmentColor = this.config.colors.damaged;
         }

         // Draw segment background (empty state) using v8+ API
         segment
            .rect(0, 0, this.config.segmentWidth, this.config.height)
            .fill({ color: this.config.colors.empty, alpha: 0.3 });

         // Draw segment fill based on health
         if (segmentCurrentHealth > 0) {
            const fillWidth = (segmentCurrentHealth / segmentMaxHealth) * this.config.segmentWidth;

            segment.rect(0, 0, fillWidth, this.config.height).fill(segmentColor);
         }

         // Draw segment border using v8+ API
         segment
            .rect(0, 0, this.config.segmentWidth, this.config.height)
            .stroke({ width: 1, color: this.config.colors.background });

         remainingHealth -= segmentCurrentHealth;
      });

      // Update health text
      if (this.healthText) {
         this.healthText.text = `${Math.ceil(this.config.currentHealth)}/${this.config.maxHealth}`;
         this.healthText.y = this.config.height + 5;
      }
   }

   /**
    * Set the position of the healthbar (now relative to entity container)
    */
   public setOffset(x: number, y: number): void {
      this.container.x = x;
      this.container.y = y;
      this.config.offset = { x, y };
   }

   /**
    * Set visibility of the healthbar
    */
   public setVisible(visible: boolean): void {
      this.isVisible = visible;
      this.container.visible = visible;
   }

   /**
    * Get whether the healthbar should be visible (when damaged)
    */
   public shouldBeVisible(): boolean {
      return this.config.currentHealth < this.config.maxHealth;
   }

   /**
    * Update healthbar configuration
    */
   public updateConfig(newConfig: Partial<HealthbarConfig>): void {
      const oldMaxHealth = this.config.maxHealth;

      // Merge new config with existing, applying defaults
      const mergedConfig = { ...this.config, ...newConfig };
      this.config = this.applyDefaults(mergedConfig);

      // Recreate segments if max health or health per segment changed
      if (
         (newConfig.maxHealth !== undefined && newConfig.maxHealth !== oldMaxHealth) ||
         newConfig.healthPerSegment !== undefined
      ) {
         this.createSegments();
      }

      this.updateDisplay();
   }

   /**
    * Cleanup when removing healthbar
    */
   public destroy(): void {
      this.segments.forEach((segment) => segment.destroy());
      this.backgroundBar.destroy();
      this.healthText?.destroy();

      if (this.container.parent) {
         this.container.parent.removeChild(this.container);
      }
      this.container.destroy();
   }

   /**
    * Get the container for external manipulation
    */
   public getContainer(): Container {
      return this.container;
   }
}

/**
 * Simple factory function to create a healthbar for any entity
 */
export function createHealthbar(
   maxHealth: number,
   entityContainer: Container,
   options?: Partial<HealthbarConfig>,
): SegmentedHealthbar {
   const config: HealthbarConfig = {
      maxHealth,
      currentHealth: maxHealth,
      ...options,
   };

   return new SegmentedHealthbar(config, entityContainer);
}
