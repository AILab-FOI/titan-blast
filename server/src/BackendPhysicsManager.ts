// server/src/BackendPhysicsManager.ts
import { BackendGame } from './BackendGame';
import { BasePhysicsManager } from 'shared/game/BasePhysicsManager';

export class BackendPhysicsManager extends BasePhysicsManager {
   private game: BackendGame;
   private gameTicker: NodeJS.Timeout | null;
   private static backendInstance: BackendPhysicsManager;
   private serverTickCount: number = 0;
   private lastServerTpsCalculation: number = 0;
   private currentServerTps: number = 0;

   private constructor(game: BackendGame) {
      super();
      this.game = game;
      this.gameTicker = null;
   }

   public static createInstance(game: BackendGame): BackendPhysicsManager {
      if (BackendPhysicsManager.backendInstance) {
         throw new Error('BackendPhysicsManager already initialized');
      }

      const instance = new BackendPhysicsManager(game);
      BasePhysicsManager.setInstance(instance);
      BackendPhysicsManager.backendInstance = instance;
      return instance;
   }

   public async init(): Promise<void> {
      await this.initPhysics();
   }

   public update(): void {
      if (this.game.isGameStarted()) {
         this.step();
      }

      // Update TPS calculation
      this.serverTickCount++;
      const currentTime = performance.now();
      if (currentTime - this.lastServerTpsCalculation >= 1000) {
         this.currentServerTps = this.serverTickCount;
         this.serverTickCount = 0;
         this.lastServerTpsCalculation = currentTime;
      }
   }

   public getServerMetrics(): { tps: number; physicsStepTime: number; tickDuration: number } {
      const timingMetrics = this.getTimingMetrics();
      return {
         tps: this.currentServerTps,
         physicsStepTime: timingMetrics.physicsStepTime,
         tickDuration: timingMetrics.tickDuration,
      };
   }
}