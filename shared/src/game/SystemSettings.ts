export const config = {
   frontendPort: 9000,
   port: 3000,
   ip: 'localhost',
};

/**
 * Defines the shape of the chunk loading area around players
 */
export enum ChunksMode {
   /** Load chunks in a rectangular/square pattern around the player */
   Rectangular = 'Rectangular',
   /** Load chunks in an elliptical/oval pattern around the player (optimized for widescreen displays) */
   Elliptic = 'Elliptic',
}

/**
 * Core game configuration settings that control gameplay mechanics,
 * performance, and system behavior across client and server
 */
export const gameSettings = {
   // === CORE GAME LOOP SETTINGS ===

   /**
    * How often the game updates in milliseconds (40ms = 25 FPS tick rate)
    * Controls the frequency of physics simulation, network updates, and game logic
    */
   gameUpdateIntervalMillis: 40,

   /**
    * Delta time for physics simulation in seconds (0.04s = 40ms converted to seconds)
    * Must match gameUpdateIntervalMillis for consistent physics behavior
    */
   gameDeltaUpdateSeconds: 0.04,

   // === MAP AND CHUNKING SETTINGS ===

   /**
    * Number of tiles contained in each chunk (both width and height)
    * Larger values = fewer chunks but more data per chunk
    * Smaller values = more chunks but less data per chunk
    */
   chunkSize: 5,

   /**
    * Default game viewport width in pixels
    * Used for camera scaling and UI layout calculations
    */
   gameWidth: 1920,

   /**
    * Default game viewport height in pixels
    * Used for camera scaling and UI layout calculations
    */
   gameHeight: 1080,

   /**
    * How often (in game ticks) to send buffered tile updates to clients
    * Higher values = less network traffic but more delayed updates
    * Lower values = more network traffic but more responsive updates
    */
   syncIntervalTicks: 5,

   // === DYNAMIC VIEW DISTANCE SYSTEM ===

   /**
    * Radius in pixels around the player where chunks should be loaded
    * Automatically calculates chunk count based on map tile size
    * Example: 800px with 32px tiles = ~5 chunks radius
    */
   viewDistancePixels: 1200,

   /**
    * Additional pixel buffer before unloading chunks beyond view distance
    * Prevents chunks from constantly loading/unloading as player moves
    * Total unload distance = viewDistancePixels + unloadBufferPixels
    */
   unloadBufferPixels: 400,

   // === MAP GENERATION SETTINGS ===

   /**
    * Rate at which player stability decreases per second
    * Higher values = players lose stability faster
    */
   mapStabilityDecayRate: 0.01,

   /**
    * Rate at which players can collect resources per second
    * Higher values = faster resource collection
    */
   mapResourceCollectionRate: 1,

   // === NETWORK OPTIMIZATION SETTINGS ===

   /**
    * Minimum distance in pixels a player must move before sending position updates
    * Reduces network traffic by filtering out tiny movements
    */
   minLinearDistanceToUpdateMovement: 0.5,

   /**
    * Minimum rotation change in radians before sending rotation updates
    * Reduces network traffic by filtering out tiny rotation changes
    */
   minAngularDiffToUpdateMovementRadians: 0.02,

   /**
    * Represents max amount of chunks that can be sent in a single network message to server -> client
    * Chunks are sent to client in ClientBound.UpdateChunks network event when player comes near them
    */
   maxChunkBatchSize: 2,

   // === PHYSICS WORLD CONFIGURATION ===

   physics: {
      /**
       * Number of constraint solver iterations per physics step
       * Higher values = more accurate but slower physics simulation
       */
      numSolverIterations: 4,

      /**
       * Number of internal PGS (Projected Gauss-Seidel) iterations per solver iteration
       * Fine-tunes constraint resolution accuracy
       */
      numInternalPgsIterations: 1,

      /**
       * Additional iterations specifically for friction resolution
       * Higher values = more realistic friction but slower simulation
       */
      numAdditionalFrictionIterations: 2,

      /**
       * Physics scale factor - how many physics units equal one game pixel
       * Should match typical game object sizes for optimal performance
       */
      lengthUnit: 64,

      /**
       * Maximum velocity any physics body can achieve (prevents runaway objects)
       * Measured in pixels per second
       */
      maxVelocity: 1000,

      /**
       * Enable Continuous Collision Detection for fast-moving objects
       * Prevents bullets and fast objects from passing through walls
       */
      ccdEnabled: true,
   },

   // === WEAPON SETTINGS ===

   /**
    * Maximum spread angle for weapons in degrees
    * Controls the maximum inaccuracy when weapon accuracy is at minimum
    */
   maxGunSpreadDegrees: 90,

   // === ENEMY TASK SCHEDULING SETTINGS ===

   /**
    * How often enemy movement tasks are executed (in ticks)
    * Current: every 3 ticks = ~120ms at 25 FPS
    * Lower values = more responsive movement but higher CPU usage
    */
   enemyMovementUpdateTicks: 2,

   /**
    * How often enemy targeting tasks are executed (in ticks)
    * Current: every 50 ticks = ~2 seconds at 25 FPS
    * Lower values = more responsive targeting but higher CPU usage
    */
   enemyTargetingUpdateTicks: 20,

   /**
    * How often enemy ability/attack tasks are executed (in ticks)
    * Current: every 4 ticks = ~160ms at 25 FPS
    * Lower values = more responsive combat but higher CPU usage
    */
   enemyAbilityUpdateTicks: 4,

   /**
    * How often pathfinding calculations are performed per batch (in ticks)
    * Current: every 5 ticks = ~200ms at 25 FPS per batch
    * Note: Pathfinding is staggered across 10 batches, so each enemy gets pathfinding every ~50 ticks
    */
   enemyPathfindingBatchTicks: 10,

   /**
    * How often enemy network updates are sent to clients (in ticks)
    * Current: every 2 ticks = ~80ms at 25 FPS
    * Lower values = smoother movement but higher network usage
    */
   enemyNetworkUpdateTicks: 2,

   /**
    * How often pathfinding update messages are sent to clients (in ticks)
    * Current: every 12 ticks = ~480ms at 25 FPS
    * Lower values = more responsive client pathfinding but higher network usage
    */
   enemyPathfindingNetworkUpdateTicks: 12,

   /**
    * How often automatic enemy spawning occurs (in ticks)
    * Current: every 25 ticks = ~1 second at 25 FPS
    * Lower values = more frequent spawn checks but higher CPU usage
    */
   enemySpawnUpdateTicks: 25,

   /**
    * Get the actual delta time in seconds for enemy movement tasks
    * Accounts for the fact that movement tasks run every N ticks, not every tick
    */
   get enemyMovementDeltaTime(): number {
      return (this.gameUpdateIntervalMillis * this.enemyMovementUpdateTicks) / 1000;
   },

   /**
    * Get the actual delta time in seconds for enemy ability tasks
    * Accounts for the fact that ability tasks run every N ticks, not every tick
    */
   get enemyAbilityDeltaTime(): number {
      return (this.gameUpdateIntervalMillis * this.enemyAbilityUpdateTicks) / 1000;
   },

   /**
    * Get the actual delta time in seconds for pathfinding batch tasks
    * Accounts for the fact that pathfinding runs every N ticks, not every tick
    */
   get enemyPathfindingDeltaTime(): number {
      return (this.gameUpdateIntervalMillis * this.enemyPathfindingBatchTicks) / 1000;
   },
};
