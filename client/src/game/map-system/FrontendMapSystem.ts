import FrontendGame from '../FrontendGame';
import { ClientChunkManager } from './ClientChunkManager';

/**
 * Frontend map system that manages the map on the client side
 */
export class FrontendMapSystem {
   // Chunk manager for handling map chunks
   private chunkManager: ClientChunkManager;

   /**
    * Create a new frontend map system
    *
    * @param game Reference to the game instance
    */
   constructor(private game: FrontendGame) {
      // Create chunk manager without initial map data
      this.chunkManager = new ClientChunkManager(
         game,
         game.getPhysicsManager().getWorld(),
         game.getPhysicsManager().getRapier(),
      );
   }

   /**
    * Update map chunks based on player position
    */
   public update(): void {
      // Get local player
      const localPlayer = this.game.getPlayerManager().getLocalPlayerSafe();
      if (!localPlayer) return;

      // Update chunks around player
      const position = localPlayer.position;
      this.chunkManager.updateChunksAroundPlayer(position.x, position.y);
   }

   /**
    * Get the chunk manager
    */
   public getChunkManager(): ClientChunkManager {
      return this.chunkManager;
   }

   /**
    * Clean up resources
    */
   public cleanup(): void {
      // Any cleanup needed
   }
}
