// shared/src/game/BasePhysicsManager.ts NEW IMPLEMENTATION
import { gameSettings } from './SystemSettings';
import type * as RAPIER from '@dimforge/rapier2d-compat';
import { TaskPriority, TaskScheduler } from '../util/TaskScheduler';

export abstract class BasePhysicsManager {
   protected world!: RAPIER.World;
   protected rapier!: typeof RAPIER;
   protected gameTick: number = 0;

   private taskScheduler: TaskScheduler;

   // Timing measurements
   private lastPhysicsStepTime: number = 0; // Time for just world.step()
   private lastTickDuration: number = 0; // Total tick time including tasks
   private tickStartTime: number = 0;

   private running: boolean = false;
   private startTime: number = 0;
   private tickTime: number = 0;
   private static instance: BasePhysicsManager;
   private taskProcessingInterval: NodeJS.Timeout | null = null;

   tickStart!: number;
   tickEnd!: number;

   protected constructor() {
      if (BasePhysicsManager.instance) {
         throw new Error('Cannot create multiple instances of BasePhysicsManager');
      }

      this.taskScheduler = new TaskScheduler(() => this.gameTick);

      // Set up a background interval for processing critical tasks
      this.taskProcessingInterval = setInterval(() => {
         this.taskScheduler.processCriticalTasks();
      }, 100); // Check every 100ms
   }

   protected static setInstance(instance: BasePhysicsManager): void {
      if (BasePhysicsManager.instance) {
         throw new Error('PhysicsManager instance already exists');
      }
      BasePhysicsManager.instance = instance;
   }

   public static getInstance(): BasePhysicsManager {
      if (!BasePhysicsManager.instance) {
         throw new Error('PhysicsManager not initialized');
      }
      return BasePhysicsManager.instance;
   }

   protected async initPhysics(): Promise<void> {
      this.rapier = await import('@dimforge/rapier2d-compat');
      await this.rapier.init();

      this.world = new this.rapier.World({ x: 0.0, y: 0.0 });

      const physics = gameSettings.physics;
      this.world.numSolverIterations = physics.numSolverIterations;
      this.world.numInternalPgsIterations = physics.numInternalPgsIterations;
      this.world.numAdditionalFrictionIterations = physics.numAdditionalFrictionIterations;
      this.world.lengthUnit = physics.lengthUnit;
      this.world.integrationParameters.maxCcdSubsteps = 4;
      this.world.timestep = gameSettings.gameDeltaUpdateSeconds;
   }

   public start(): void {
      if (this.running) return;

      this.running = true;
      this.startTime = this.getCurrentTime();
      this.tickTime = this.getCurrentTime();
      console.log('started AT:', this.startTime);

      this.runUpdate();
   }

   public getCurrentTickTime(): number {
      return this.tickTime;
   }

   public getCurrentTime(): number {
      return performance.timeOrigin + performance.now();
   }

   /**
    * Method to schedule ticks for the server game loop
    * @private
    */
   protected runUpdate(): void {
      if (!this.running) return;

      this.tickStart = this.getCurrentTime();
      this.tickStartTime = performance.now(); // Start measuring total tick time

      const currentTime = this.getCurrentTime();
      const nextTickStartTime = this.startTime + (this.gameTick + 1) * gameSettings.gameUpdateIntervalMillis;
      const delayUntilNextTick = nextTickStartTime - currentTime;

      setTimeout(() => this.runUpdate(), delayUntilNextTick);

      // Run the update
      this.tickTime = this.getCurrentTime();
      this.gameTick++;
      this.update();
      this.taskScheduler.processTasks();
      this.tickEnd = this.getCurrentTime();

      // Calculate total tick duration
      this.lastTickDuration = performance.now() - this.tickStartTime;
   }

   /**
    * Schedule a task to run after a specified number of ticks
    */
   public scheduleTask(
      callback: () => void,
      priority: TaskPriority = TaskPriority.NORMAL,
      delayTicks: number = 1,
   ): string {
      return this.taskScheduler.scheduleTask(callback, priority, delayTicks);
   }

   /**
    * Schedule a task to run repeatedly at the specified interval
    */
   public scheduleRepeatingTask(
      callback: () => void,
      intervalTicks: number,
      initialDelay?: number,
      priority: TaskPriority = TaskPriority.NORMAL,
   ): string {
      return this.taskScheduler.scheduleRepeatingTask(callback, intervalTicks, initialDelay, priority);
   }

   /**
    * Cancel a scheduled task
    */
   public cancelTask(taskId: string): boolean {
      return this.taskScheduler.cancelTask(taskId);
   }

   /**
    * Physics step with timing measurement
    */
   protected step(): void {
      const stepStartTime = performance.now();
      this.world.step();
      this.lastPhysicsStepTime = performance.now() - stepStartTime;
   }

   /**
    * Get timing metrics for performance monitoring
    */
   public getTimingMetrics(): { physicsStepTime: number; tickDuration: number } {
      return {
         physicsStepTime: this.lastPhysicsStepTime,
         tickDuration: this.lastTickDuration,
      };
   }

   public stop(): void {
      this.running = false;
   }

   public destroy(): void {
      this.stop();

      // Clear the task processing interval
      if (this.taskProcessingInterval) {
         clearInterval(this.taskProcessingInterval);
         this.taskProcessingInterval = null;
      }

      if (this.world) {
         this.world.free();
      }
   }

   public getWorld(): RAPIER.World {
      return this.world;
   }

   public getRapier(): typeof RAPIER {
      return this.rapier;
   }

   public getGameTick(): number {
      return this.gameTick;
   }

   public isRunning(): boolean {
      return this.running;
   }

   public getTaskScheduler(): TaskScheduler {
      return this.taskScheduler;
   }

   public abstract update(): void;
}