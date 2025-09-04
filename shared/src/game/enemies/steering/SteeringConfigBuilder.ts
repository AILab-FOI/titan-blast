import { SeparationBehavior } from './behaviors/SeparationBehavior';
import { SteeringController } from './SteeringController';
import { DEFAULT_SEPARATION_CONFIG, SeparationConfig } from './SteeringTypes';

/**
 * Builder pattern for configuring enemy steering behaviors
 */
export class SteeringConfigBuilder {
   private controller = new SteeringController();

   /**
    * Configure separation behavior
    */
   public withSeparation(config?: Partial<SeparationConfig>): this {
      const finalConfig = { ...DEFAULT_SEPARATION_CONFIG, ...config };
      const separationBehavior = new SeparationBehavior(finalConfig);
      this.controller.addBehavior(separationBehavior);
      return this;
   }

   /**
    * Disable all steering behaviors
    */
   public withNoSteering(): this {
      this.controller.setEnabled(false);
      return this;
   }

   /**
    * Build the final steering controller
    */
   public build(): SteeringController {
      return this.controller;
   }

   /**
    * Create a new builder instance
    */
   public static create(): SteeringConfigBuilder {
      return new SteeringConfigBuilder();
   }
}
