import { InputManager } from './InputManager';
import { ServerBound } from 'shared/game/network/SocketEvents';
import { FrontendPhysicsManager } from './FrontendPhysicsManager';
import { RenderManager } from './rendering/RenderManager';
import { PlayerManager } from './PlayerManager';
import { InputProcessor } from './InputProcessor';
import { AssetLoader } from './AssetLoader';
import { TrailManager } from './rendering/trails/TrailManager';
import { EntityManager } from 'shared/game/EntityManager';
import { BaseGame } from 'shared/game/BaseGame';
import { User } from 'shared/auth/AuthModels';
import { ClientGeckosTransport } from './network/ClientGeckosTransport';
import { AuthService } from '../services/AuthService';
import { PlayerData } from 'shared/game/PlayerData';
import { FrontendMapSystem } from './map-system/FrontendMapSystem';
import { TaskPriority } from 'shared/util/TaskScheduler';
import { PlayerNetworkHandler } from './handlers/PlayerNetworkHandler';
import { GameFlowNetworkHandler } from './handlers/GameFlowNetworkHandler';
import { MapNetworkHandler } from './handlers/MapNetworkHandler';
import { PerformanceMonitor } from './performance/PerformanceMonitor';
import { ServerMetricsNetworkHandler } from './handlers/ServerMetricsNetworkHandler';
import { ClientEnemyManager } from './enemies/ClientEnemyManager';
import { EnemyNetworkHandler } from './handlers/EnemyNetworkHandler';
import { GameEffectsManager } from './effects/GameEffectsManager';

export default class FrontendGame extends BaseGame {
   private inputManager: InputManager;
   private clientSocket: ClientGeckosTransport;
   private physicsManager: FrontendPhysicsManager;
   private renderManager: RenderManager;
   private assets: AssetLoader;
   private playerManager!: PlayerManager;
   private inputProcessor!: InputProcessor;
   private trailManager!: TrailManager;
   private entityManager!: EntityManager;
   private localUser!: User;

   private mapSystem!: FrontendMapSystem;
   private performanceMonitor!: PerformanceMonitor;

   private clientEnemyManager!: ClientEnemyManager;
   private enemyNetworkHandler!: EnemyNetworkHandler;
   private gameEffectsManager?: GameEffectsManager;

   playerId!: string | null;

   constructor(assets: AssetLoader, user: User) {
      super();
      this.physicsManager = FrontendPhysicsManager.createInstance(this);
      this.renderManager = new RenderManager(this);
      this.inputManager = new InputManager(this);
      this.trailManager = new TrailManager();
      this.entityManager = new EntityManager();
      this.clientSocket = new ClientGeckosTransport();
      this.assets = assets;
      this.localUser = user;
   }

   public async init(): Promise<void> {
      try {
         const authService = AuthService.getInstance();
         const token = authService.getUser()?.token;
         console.log('token', token);

         if (!token) {
            throw new Error('No authentication token available');
         }

         await this.clientSocket.connect({
            user: this.localUser,
            token: token,
         });

         await this.physicsManager.init();
         await this.renderManager.init();

         this.performanceMonitor = new PerformanceMonitor();
         document.body.appendChild(this.performanceMonitor);
         this.clientSocket.setPerformanceMonitor(this.performanceMonitor);

         setInterval(() => {
            const pingManager = this.clientSocket.getPingManager();
            if (pingManager) {
               this.performanceMonitor.updatePingMetrics(pingManager.getCurrentPing(), pingManager.getAveragePing());
            }
         }, 1000);

         this.playerManager = new PlayerManager(this, this.localUser.username);
         this.inputProcessor = new InputProcessor(this);

         this.mapSystem = new FrontendMapSystem(this);
         this.gameEffectsManager = new GameEffectsManager();

         this.initializeEnemySystem();

         this.initNetworkMessageSystem();
         this.registerNetworkHandlers();
         this.networkMessageManager.connectToTransport(this.clientSocket);

         this.clientSocket.broadcast(ServerBound.PlayerConnect, {
            userInfo: new PlayerData(
               this.localUser.id,
               this.localUser.username,
               this.localUser.displayName || this.localUser.username,
            ),
         });

         this.setupRepeatingTasks();

         console.log('CLIENT READY');
         // this.setupNetworkHandlers();
      } catch (error) {
         console.error('Failed to initialize game:', error);
         throw error;
      }
   }

   private registerNetworkHandlers() {
      this.networkMessageManager.registerHandler(new PlayerNetworkHandler(this));
      this.networkMessageManager.registerHandler(new GameFlowNetworkHandler(this));
      this.networkMessageManager.registerHandler(new MapNetworkHandler(this));
      this.networkMessageManager.registerHandler(new ServerMetricsNetworkHandler(this));
   }

   private setupRepeatingTasks(): void {
      this.physicsManager.scheduleRepeatingTask(
         () => {
            this.mapSystem.update();
         },
         5,
         0,
         TaskPriority.HIGH,
      );

      this.renderManager.scheduleRepeatingTask(
         () => {
            this.playerManager.getPlayers().forEach((player) => {
               player.update();
            });

            const localPlayer = this.playerManager.getLocalPlayerSafe();
            if (!localPlayer) return;

            const mousePosition = this.inputManager.getMousePosition();
            const worldCoords = this.renderManager.getCamera().screenToWorldPosition(mousePosition);

            if (worldCoords) {
               localPlayer.aim(worldCoords);
            }
         },
         1,
         0,
         TaskPriority.NORMAL,
      );

      this.renderManager.scheduleRepeatingTask(
         () => {
            this.gameEffectsManager?.update();
         },
         1, // Every frame
         0, // No initial delay
         TaskPriority.HIGH,
      );
   }

   /**
    * Initialize the enemy management system
    */
   private initializeEnemySystem(): void {
      // Create client enemy manager
      this.clientEnemyManager = new ClientEnemyManager(this.assets, this.renderManager, this);
      this.clientEnemyManager.initializePhysics(this.physicsManager.getWorld(), this.physicsManager.getRapier());

      // Create enemy network handler
      this.enemyNetworkHandler = new EnemyNetworkHandler(this);

      // Register enemy network handler
      this.networkMessageManager.registerHandler(this.enemyNetworkHandler);

      // Schedule enemy updates using physics manager (like you do for other systems)
      this.renderManager.scheduleRepeatingTask(
         () => {
            if (this.clientEnemyManager) {
               this.clientEnemyManager.update();
            }
         },
         1, // Every tick
         0, // No initial delay
         TaskPriority.NORMAL,
      );

      console.log('Enemy system initialized');
   }

   private startGame(): void {
      this.physicsManager.start();
      this.renderManager.startRendering();
   }

   public getInputManager() {
      return this.inputManager;
   }

   public getRenderManager() {
      return this.renderManager;
   }

   public getAssets() {
      return this.assets;
   }

   public getPlayerManager(): PlayerManager {
      return this.playerManager;
   }

   public getInputProcessor(): InputProcessor {
      return this.inputProcessor;
   }

   public getTrailManager(): TrailManager {
      return this.trailManager;
   }

   public getEntityManager(): EntityManager {
      return this.entityManager;
   }

   public getClientTransport(): ClientGeckosTransport {
      return this.clientSocket;
   }

   public getPhysicsManager(): FrontendPhysicsManager {
      return this.physicsManager;
   }

   public getMapSystem(): FrontendMapSystem {
      return this.mapSystem;
   }

   /**
    * Clean up game resources
    */
   public cleanup(): void {
      // Clean up physics
      this.physicsManager.stop();

      // Clean up rendering
      this.renderManager.stopRendering();

      // Clean up map system
      this.mapSystem.cleanup();

      if (this.performanceMonitor && this.performanceMonitor.parentNode) {
         this.performanceMonitor.parentNode.removeChild(this.performanceMonitor);
      }

      // Clean up network connection
      this.clientSocket.disconnect();
   }

   public getTileSize(): number {
      // Get tile size from the map system's chunk manager
      if (this.mapSystem && this.mapSystem.getChunkManager()) {
         return this.mapSystem.getChunkManager().getTileSize();
      }

      // Fallback to a reasonable default if map system isn't initialized yet
      return 32;
   }

   public getPerformanceMonitor(): PerformanceMonitor {
      return this.performanceMonitor;
   }

   public getEnemyManager(): ClientEnemyManager {
      return this.clientEnemyManager;
   }

   public getEffectsManager(): GameEffectsManager | undefined {
      return this.gameEffectsManager;
   }
}
