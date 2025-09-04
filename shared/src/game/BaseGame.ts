import { EntityManager } from './EntityManager';
import { EventHandlerManager } from './events/EventHandlerManager';
import { BasePhysicsManager } from './BasePhysicsManager';
import { NetworkMessageManager } from './network/NetworkMessageHandler';
import { INetworkTransport } from './network/INetworkTransport';

export abstract class BaseGame {
   public eventHandlerManager!: EventHandlerManager;
   public networkMessageManager!: NetworkMessageManager;

   constructor() {
      this.eventHandlerManager = new EventHandlerManager(this);
      this.networkMessageManager = new NetworkMessageManager(this);
   }

   public abstract getEntityManager(): EntityManager;

   public abstract getPhysicsManager(): BasePhysicsManager;

   /**
    * Get the current map's tile size
    * This should be implemented by child classes to return the appropriate tile size
    */
   public abstract getTileSize(): number;

   /**
    * Initialize the network message system
    */
   protected initNetworkMessageSystem(): void {
      this.networkMessageManager.initialize();
   }

   // /**
   //  * Sets up event handlers. Called by child classes after their initialization.
   //  */
   // protected setupEventHandlers(): void {
   //    // Initialize the event handler manager with base handlers
   //    this.eventHandlerManager.initialize();
   // }
   //
   // /**
   //  * Cleanup event handlers. Should be called when game ends / is destroyed.
   //  */
   // protected cleanupEventHandlers(): void {
   //    this.eventHandlerManager.cleanup();
   // }
}
