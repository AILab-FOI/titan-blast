// client/src/game/FrontendPhysicsManager.ts
import FrontendGame from './FrontendGame';
import { BasePhysicsManager } from 'shared/game/BasePhysicsManager';

export class FrontendPhysicsManager extends BasePhysicsManager {
   private updateTimer: NodeJS.Timeout | null = null;
   private game: FrontendGame;
   private static frontendInstance: FrontendPhysicsManager;

   private constructor(game: FrontendGame) {
      super();
      this.game = game;
   }

   public static createInstance(game: FrontendGame): FrontendPhysicsManager {
      if (FrontendPhysicsManager.frontendInstance) {
         throw new Error('FrontendPhysicsManager already initialized');
      }

      const instance = new FrontendPhysicsManager(game);
      BasePhysicsManager.setInstance(instance);
      FrontendPhysicsManager.frontendInstance = instance;
      return instance;
   }

   public async init(): Promise<void> {
      await this.initPhysics();
   }

   public update(): void {
      if (!this.world) return;

      const playerManager = this.game.getPlayerManager();
      this.game.getInputProcessor().processInput(playerManager.getLocalPlayer());
      this.step();

      playerManager.getLocalPlayer().trackMovement();
      const timingMetrics = this.getTimingMetrics();
      this.game
         .getPerformanceMonitor()
         .updateClientTimingMetrics(timingMetrics.physicsStepTime, timingMetrics.tickDuration);
   }

   /**
    * Get client physics metrics for performance monitoring
    */
   public getClientMetrics(): { physicsStepTime: number; tickDuration: number } {
      return this.getTimingMetrics();
   }
}
