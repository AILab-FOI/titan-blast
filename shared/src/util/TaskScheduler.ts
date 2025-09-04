// shared/src/util/TaskScheduler.ts NEW IMPLEMENTATION
export enum TaskPriority {
   CRITICAL = 0, // Execute immediately, even if game isn't running
   HIGH = 1, // High priority tasks during normal execution
   NORMAL = 2, // Standard game logic tasks
   LOW = 3, // Background or non-time-sensitive tasks
}

interface ScheduledTask {
   callback: () => void;
   id: string;
   priority: TaskPriority;
   repeat?: number; // If set, repeat every X ticks
}

/**
 * Generic task scheduler that can be used for both physics and rendering
 */
export class TaskScheduler {
   // Organize tasks by execution tick for O(1) access to ready tasks
   private tasksByExecutionTick: Map<number, Map<string, ScheduledTask>> = new Map();

   // Keep track of repeating tasks separately
   private repeatingTasks: Map<string, { interval: number; nextTick: number; task: ScheduledTask }> = new Map();

   // Critical tasks that need immediate execution
   private criticalTaskQueue: (() => void)[] = [];

   private nextTaskId: number = 0;
   private gameTickProvider: () => number;

   constructor(gameTickProvider: () => number) {
      this.gameTickProvider = gameTickProvider;
   }

   /**
    * Get the current game tick from the provider
    */
   public getCurrentGameTick(): number {
      return this.gameTickProvider();
   }

   /**
    * Process critical tasks - can be called outside game loop
    */
   public processCriticalTasks(): void {
      while (this.criticalTaskQueue.length > 0) {
         const task = this.criticalTaskQueue.shift();
         if (task) {
            try {
               task();
            } catch (error) {
               console.error('Error executing critical task:', error);
            }
         }
      }
   }

   /**
    * Process all scheduled tasks for the current tick - O(1) access to ready tasks
    */
   public processTasks(): void {
      // First handle any critical tasks
      this.processCriticalTasks();

      const currentGameTick = this.getCurrentGameTick();

      // Process tasks scheduled for this tick - O(1) access!
      const currentTickTasks = this.tasksByExecutionTick.get(currentGameTick);
      if (currentTickTasks) {
         // console.log(`📋 Found ${currentTickTasks.size} tasks for tick ${currentGameTick}`);
         // Execute tasks in priority order (HIGH, NORMAL, LOW)
         this.executeTasksForPriority(currentTickTasks, TaskPriority.HIGH);
         this.executeTasksForPriority(currentTickTasks, TaskPriority.NORMAL);
         this.executeTasksForPriority(currentTickTasks, TaskPriority.LOW);

         // Handle repeating tasks before removing the current tick's task map
         this.rescheduleRepeatingTasks(currentGameTick);

         // Once all tasks are processed, remove this tick's task map
         this.tasksByExecutionTick.delete(currentGameTick);
      } else {
         // If no tasks for this tick, still need to check for repeating tasks
         this.rescheduleRepeatingTasks(currentGameTick);
      }

      // Clean up old tick entries (optional, for very long-running games)
      this.cleanupOldTaskTicks(currentGameTick);
   }

   /**
    * Execute tasks for a specific priority level
    */
   private executeTasksForPriority(tasks: Map<string, ScheduledTask>, priority: TaskPriority): void {
      for (const [id, task] of tasks.entries()) {
         if (task.priority === priority) {
            try {
               task.callback();
            } catch (error) {
               console.error(`Error executing ${priority} priority task ${id}:`, error);
            }
         }
      }
   }

   /**
    * Reschedule repeating tasks for their next execution
    */
   private rescheduleRepeatingTasks(currentGameTick: number): void {
      for (const [id, info] of this.repeatingTasks.entries()) {
         if (info.nextTick === currentGameTick) {
            // Calculate the next execution tick
            const nextTick = currentGameTick + info.interval;

            // Update the next tick info
            this.repeatingTasks.set(id, {
               interval: info.interval,
               nextTick: nextTick,
               task: info.task,
            });

            // Schedule the task for its next execution using the stored task reference
            this.scheduleTaskForTick(info.task, nextTick);
         }
      }
   }

   /**
    * Helper to schedule a task for a specific tick
    */
   private scheduleTaskForTick(task: ScheduledTask, tick: number): void {
      // Create map for this tick if it doesn't exist
      if (!this.tasksByExecutionTick.has(tick)) {
         this.tasksByExecutionTick.set(tick, new Map());
      }

      // Add task to the appropriate tick map
      this.tasksByExecutionTick.get(tick)!.set(task.id, task);
   }

   /**
    * Clean up task entries for ticks that have already passed
    * This is an optimization for very long-running games
    */
   private cleanupOldTaskTicks(currentGameTick: number): void {
      // Only run this cleanup occasionally to avoid overhead
      if (currentGameTick % 1000 === 0) {
         for (const tick of this.tasksByExecutionTick.keys()) {
            if (tick < currentGameTick - 100) {
               this.tasksByExecutionTick.delete(tick);
            }
         }
      }
   }

   /**
    * Schedule a task to run after a specified number of ticks
    */
   public scheduleTask(
      callback: () => void,
      priority: TaskPriority = TaskPriority.NORMAL,
      delayTicks: number = 1,
   ): string {
      // Handle critical tasks immediately
      if (priority === TaskPriority.CRITICAL) {
         this.criticalTaskQueue.push(callback);
         return `critical_task_${Date.now()}`;
      }

      // For other priorities, schedule based on execution tick
      const taskId = `task_${++this.nextTaskId}`;
      const task: ScheduledTask = {
         callback,
         id: taskId,
         priority,
      };

      // Calculate the target tick
      const currentGameTick = this.getCurrentGameTick();
      const executionTick = currentGameTick + delayTicks;

      // console.log('scheduling task for tick', executionTick, 'current tick', currentGameTick);
      // Schedule the task for that tick
      this.scheduleTaskForTick(task, executionTick);

      return taskId;
   }

   /**
    * Schedule a task to be executed on the next tick
    */
   public scheduleOnce(callback: () => void, priority: TaskPriority = TaskPriority.NORMAL): string {
      return this.scheduleTask(callback, priority, 1);
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
      // Critical repeating tasks are not supported - they should be handled differently
      if (priority === TaskPriority.CRITICAL) {
         console.warn('Critical repeating tasks are not supported. Using HIGH priority instead.');
         priority = TaskPriority.HIGH;
      }

      const taskId = `repeating_task_${++this.nextTaskId}`;
      const task: ScheduledTask = {
         callback,
         id: taskId,
         priority,
         repeat: intervalTicks,
      };

      // Calculate the first execution tick
      const currentGameTick = this.getCurrentGameTick();
      const baseDelay = initialDelay ?? intervalTicks;
      const firstExecutionTick = Math.max(1, currentGameTick + baseDelay);

      console.log(
         `🔄 Scheduling repeating task ${taskId} for first execution at tick ${firstExecutionTick} (current: ${currentGameTick}, interval: ${intervalTicks})`,
      );

      // Track this as a repeating task - store the task reference
      this.repeatingTasks.set(taskId, {
         interval: intervalTicks,
         nextTick: firstExecutionTick,
         task: task,
      });

      // Schedule the first execution
      this.scheduleTaskForTick(task, firstExecutionTick);

      return taskId;
   }

   /**
    * Cancel a scheduled task
    */
   public cancelTask(taskId: string): boolean {
      // Check if it's a repeating task
      if (this.repeatingTasks.has(taskId)) {
         this.repeatingTasks.delete(taskId);
      }

      // Find and remove the task from any tick's task list
      for (const tickTasks of this.tasksByExecutionTick.values()) {
         if (tickTasks.has(taskId)) {
            tickTasks.delete(taskId);
            return true;
         }
      }

      return false;
   }

   /**
    * Reset the scheduler
    */
   public reset(): void {
      this.tasksByExecutionTick.clear();
      this.repeatingTasks.clear();
      this.criticalTaskQueue = [];
   }
}
