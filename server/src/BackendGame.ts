import { BackendPhysicsManager } from './BackendPhysicsManager';
import { PlayerManager } from './PlayerManager';
import { ClientBound } from 'shared/game/network/SocketEvents';
import { config, gameSettings } from 'shared/game/SystemSettings';
import RAPIER, { EventQueue } from '@dimforge/rapier2d-compat';
import { GameStartData } from 'shared/game/network/messages/client-bound/GameStartData';
import { PlayerInputBuffer } from './types/PlayerInputBuffer';
import { EntityManager } from 'shared/game/EntityManager';
import { BaseGame } from 'shared/game/BaseGame';
import { ServerGeckosTransport } from './network/ServerGeckosTransport';
import http from 'http';
import { initAuthMiddleware } from './middleware/AuthMiddleware';
import { BackendMapSystem } from './map-system/BackendMapSystem';
import { PlayerConnectionHandler } from './handlers/PlayerConnectionHandler';
import { PlayerActionHandler } from './handlers/PlayerActionHandler';
import { TaskPriority } from 'shared/util/TaskScheduler';
import { MapNetworkHandler } from './handlers/MapNetworkHandler';
import { EnemyManager } from './enemies/EnemyManager';
import { EnemyDamageEventBatch } from 'shared/game/network/messages/client-bound/DamageEvents';
import { DamageService } from 'shared/game/shooting/DamageService';
import { PingServerHandler } from './handlers/PingServerHandler';

export class BackendGame extends BaseGame {
   private world!: RAPIER.World;
   private RAPIER!: typeof import('@dimforge/rapier2d-compat');
   public gameId: string;
   private playerManager!: PlayerManager;
   private physicsManager!: BackendPhysicsManager;
   private gameStarted: boolean;
   private mapSeed: string;
   private eventQueue!: EventQueue;
   private entityManager!: EntityManager;
   private serverTransport: ServerGeckosTransport;

   private mapSystem!: BackendMapSystem;

   private playerMovemementInputs = new PlayerInputBuffer();
   private enemyManager!: EnemyManager;

   // private enemyNetworkHandler!: EnemyNetworkHandler;

   constructor(gameId: string) {
      super();
      this.gameId = gameId;
      this.serverTransport = new ServerGeckosTransport();
      this.gameStarted = false;
      this.mapSeed = Date.now().toString();
      this.entityManager = new EntityManager();

      // this.networkManager = new NetworkManager(this.gameSocket);
   }

   public async init(port: number = config.port, server?: http.Server) {
      const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:4000';

      initAuthMiddleware(authServiceUrl);

      try {
         await this.serverTransport.connect({
            port: port,
            server: server,
            gameId: this.gameId,
            cors: {
               origin: 'http://localhost:9000',
               allowAuthorization: true,
            },
         });

         this.initNetworkMessageSystem();
         this.registerNetworkHandlers();
         this.networkMessageManager.connectToTransport(this.serverTransport);
      } catch (error) {
         console.error('Failed to initialize socket:', error);
      }

      // Initialize Rapier physics
      try {
         this.RAPIER = await import('@dimforge/rapier2d-compat');
         await RAPIER.init();
         this.eventQueue = new this.RAPIER.EventQueue(true);
      } catch (error) {
         console.error('Failed to load Rapier:', error);
         throw error;
      }

      // Initialize managers that depend on physics
      this.playerManager = new PlayerManager(this, 2, 4);
      this.physicsManager = BackendPhysicsManager.createInstance(this);
      await this.physicsManager.init();
      this.world = this.physicsManager.getWorld();

      this.mapSystem = new BackendMapSystem(
         this.world,
         this.RAPIER,
         this.serverTransport,
         this.playerManager,
         this.physicsManager,
         this,
      );

      this.mapSystem.initialize();

      this.initializeEnemySystem();

      this.setupRepeatingTasks();
   }

   private registerNetworkHandlers() {
      console.log('registering network handlers');
      this.networkMessageManager.registerHandler(new PlayerConnectionHandler(this));
      this.networkMessageManager.registerHandler(new PlayerActionHandler(this));
      this.networkMessageManager.registerHandler(new MapNetworkHandler(this));
      this.networkMessageManager.registerHandler(new PingServerHandler(this));
   }

   /**
    * Initialize the enemy management system
    */
   private initializeEnemySystem(): void {
      // Create enemy manager
      this.enemyManager = new EnemyManager(
         this.world,
         this.RAPIER,
         this.entityManager,
         this.serverTransport,
         this,
         this.mapSystem,
         this.playerManager,
      );

      // Create enemy network handler
      // this.enemyNetworkHandler = new EnemyNetworkHandler(this);
      //
      // // Register enemy network handler
      // this.networkMessageManager.registerHandler(this.enemyNetworkHandler);

      console.log('Enemy system initialized on server');
   }

   /**
    * Set up repeating tasks that need to run during the game
    * This is called when the game starts
    */
   private setupRepeatingTasks(): void {
      // Schedule player updates to run every tick
      this.physicsManager.scheduleRepeatingTask(
         () => this.updatePlayers(),
         1,
         0,
         TaskPriority.NORMAL,
      );

      this.physicsManager.scheduleRepeatingTask(
         () => this.broadcastServerMetrics(),
         10,
         0,
         TaskPriority.LOW,
      );

      this.physicsManager.scheduleRepeatingTask(
         () => this.sendDamageEvents(),
         1,
         0,
         TaskPriority.LOW,
      );
   }

   public startGame(): void {
      if (this.gameStarted) return;
      console.log('starting game');

      const START_DELAY = 1000;
      const startData: GameStartData = {
         scheduledStartTime: this.physicsManager.getCurrentTime() + START_DELAY,
         serverTick: 0,
         serverTime: this.physicsManager.getCurrentTime() + START_DELAY,
      };

      this.serverTransport.broadcast(ClientBound.StartGame, startData);

      const timeUntilStart = Math.max(0, startData.scheduledStartTime - this.physicsManager.getCurrentTime());
      setTimeout(() => {
         this.gameStarted = true;
         this.physicsManager.start();
         console.log('Server started at:', performance.now());
      }, timeUntilStart);
   }

   public stopGame(): void {
      this.gameStarted = false;
      this.physicsManager.stop();
      this.resetGame();
      this.serverTransport.broadcast(ClientBound.StopGame, 'Game stopped by server');
      // this.broadcastToAll(GameSocketEvent.StopGame, {});
      console.log('GAME STOPPED');
   }

   public isGameStarted(): boolean {
      return this.gameStarted;
   }

   public getMapSeed() {
      return this.mapSeed;
   }

   private resetGame(): void {

   }

   public getGameLoop() {
      return this.physicsManager;
   }

   public getWorld(): RAPIER.World {
      return this.world;
   }

   public getRapier(): typeof import('@dimforge/rapier2d-compat') {
      return this.RAPIER;
   }

   public getEntityManager(): EntityManager {
      return this.entityManager;
   }

   updatePlayers() {
      const playerMovementUpdates = this.playerManager.getPlayerUpdates();
      const processedUpdates = playerMovementUpdates.map((movementUpdate) => {
         const latestInput = this.playerMovemementInputs.getLatestInput(movementUpdate.username);

         if (!latestInput) {
            // console.log('sending update before any player input', movementUpdate.gameTick);
            // No previous input exists, use time since game start for prediction
            console.log('SENDING NO LATEST INPUT CASE');
            return {
               ...movementUpdate,
               predictionTimestamp: this.physicsManager.getCurrentTickTime(),
               predictionTick: this.physicsManager.getGameTick(),
            };
         }

         // console.log(movementUpdate.gameTick, latestInput.receivedAtTick);
         if (movementUpdate.gameTick === latestInput.receivedAtTick) {
            // This movement update corresponds directly to a player input
            return {
               ...movementUpdate,
               predictionTimestamp: latestInput.timestamp,
               predictionTick: latestInput.clientGameTick,
            };
         } else {
            // This movement update is from momentum/external forces
            // Calculate ticks passed since last client input. So if last client input tick was 20,
            // if 3 ticks pasted since then, send 23
            const ticksSinceLastInput = movementUpdate.gameTick - latestInput.receivedAtTick;
            const timeSinceLastInput = ticksSinceLastInput * gameSettings.gameUpdateIntervalMillis;

            return {
               ...movementUpdate,
               predictionTimestamp: latestInput.timestamp + timeSinceLastInput,
               predictionTick: latestInput.clientGameTick + ticksSinceLastInput,
            };
         }
      });

      this.serverTransport.broadcast(ClientBound.UpdateAllPlayers, processedUpdates);
   }

   /**
    * Send damage events to clients for immediate visual feedback
    */
   private sendDamageEvents(): void {
      // Get recent damage events from DamageService (already exists!)
      const damageEvents = DamageService.getRecentDamageEvents();

      if (damageEvents.length === 0) return;

      // Use the existing DamageEvent format directly - no conversion needed!
      const batch: EnemyDamageEventBatch = {
         events: damageEvents, // Direct use of existing DamageEvent[]
         tick: this.physicsManager.getGameTick(),
         timestamp: this.physicsManager.getCurrentTime(),
      };

      // Send to all clients immediately
      this.serverTransport.broadcast(ClientBound.EnemyDamage, batch);

      console.log(`📡 Sent ${damageEvents.length} damage events`);
   }

   public getMapSystem(): BackendMapSystem {
      return this.mapSystem;
   }

   public getPlayerManager(): PlayerManager {
      return this.playerManager;
   }

   public getServerTransport(): ServerGeckosTransport {
      return this.serverTransport;
   }

   public getPlayerMovementInputs(): PlayerInputBuffer {
      return this.playerMovemementInputs;
   }

   public getPhysicsManager(): BackendPhysicsManager {
      return this.physicsManager;
   }

   public getTileSize(): number {
      // Get tile size from the map system
      if (this.mapSystem && this.mapSystem.getWorldMap()) {
         return this.mapSystem.getWorldMap().getTileSize();
      }

      // Fallback to a reasonable default if map system isn't initialized yet
      return 32;
   }

   private broadcastServerMetrics(): void {
      const metrics = this.physicsManager.getServerMetrics();
      const serverMetricsData = {
         tps: metrics.tps,
         physicsStepTimeMs: metrics.physicsStepTime,
         tickTimeMs: metrics.tickDuration,
         totalPlayers: this.playerManager.getPlayers().size,
         timestamp: this.physicsManager.getCurrentTime(),
      };

      this.serverTransport.broadcast(ClientBound.ServerMetrics, serverMetricsData);
   }

   /**
    * Get the enemy manager
    */
   public getEnemyManager(): EnemyManager {
      return this.enemyManager;
   }
}
