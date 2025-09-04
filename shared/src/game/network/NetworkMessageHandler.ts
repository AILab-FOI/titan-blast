// shared/src/game/events/NetworkMessageManager.ts
import { BaseGame } from '../BaseGame';
import { ClientBound, isHybridEvent, isPreGameEvent, ServerBound } from './SocketEvents';
import { NetworkEventType, NetworkMessageHandlerMetadata, networkMessageRegistry } from './NetworkMessageDecorators';
import { TaskPriority } from '../../util/TaskScheduler';

export class NetworkMessageManager {
   private game: BaseGame;
   private registeredHandlers: Map<string, any> = new Map();
   private handlerInstanceCache: Map<any, any> = new Map();
   private handlerToInstanceMap: Map<NetworkMessageHandlerMetadata, any> = new Map();

   private isInitialized: boolean = false;

   constructor(game: BaseGame) {
      this.game = game;
   }

   /**
    * Initialize the network message manager
    */
   public initialize(): void {
      if (this.isInitialized) return;
      this.isInitialized = true;
   }

   /**
    * Register a handler instance
    * @param instance Handler instance
    * @param name Optional name (defaults to constructor name)
    */
   public registerHandler(instance: any, name?: string): void {
      const handlerName = name || instance.constructor.name;

      // Store instance by name
      this.registeredHandlers.set(handlerName, instance);

      // Also store by prototype for decorator metadata lookups
      const prototype = Object.getPrototypeOf(instance);
      this.registeredHandlers.set(prototype, instance);

      // Pre-cache the instance
      this.handlerInstanceCache.set(prototype, instance);
      this.handlerInstanceCache.set(instance.constructor, instance);
      this.handlerInstanceCache.set(handlerName, instance);

      // Optimize by pre-mapping handlers to instances
      this.preMapHandlersToInstance(instance);
   }

   /**
    * Pre-map all handlers for this instance for faster lookup during event processing
    */
   private preMapHandlersToInstance(instance: any): void {
      const prototype = Object.getPrototypeOf(instance);
      const className = instance.constructor.name;

      // Check client-bound handlers
      for (const [eventType, handlers] of networkMessageRegistry.clientBound.entries()) {
         for (const handler of handlers) {
            if (
               handler.target === prototype ||
               (typeof handler.target === 'function' && handler.target.name === className)
            ) {
               // This handler belongs to this instance - create a direct mapping
               this.handlerToInstanceMap.set(handler, instance);
            }
         }
      }

      // Check server-bound handlers
      for (const [eventType, handlers] of networkMessageRegistry.serverBound.entries()) {
         for (const handler of handlers) {
            if (
               handler.target === prototype ||
               (typeof handler.target === 'function' && handler.target.name === className)
            ) {
               // This handler belongs to this instance - create a direct mapping
               this.handlerToInstanceMap.set(handler, instance);
            }
         }
      }
   }

   /**
    * Connect to a client or server transport
    * @param transport The network transport
    */
   public connectToTransport(transport: any): void {
      if (this.isClientSide()) {
         this.connectToClientTransport(transport);
      } else {
         this.connectToServerTransport(transport);
      }
   }

   /**
    * Connect to client transport
    */
   private connectToClientTransport(transport: any): void {
      console.log('connecting to CLIENT TRANSPORT');
      // For each registered client-bound message type
      for (const [eventType, handlers] of networkMessageRegistry.clientBound.entries()) {
         // console.log('registering for ', eventType, ' with ', handlers.size, ' handlers');
         if (handlers.size > 0) {
            // Register for this message type with the transport
            transport.onMessage(eventType, (data: any) => {
               this.handleNetworkMessage(eventType, data);
            });
         }
      }
   }

   /**
    * Connect to server transport
    */
   private connectToServerTransport(transport: any): void {
      // For each registered server-bound message type
      for (const [eventType, handlers] of networkMessageRegistry.serverBound.entries()) {
         if (handlers.size > 0) {
            // Register for this message type with the transport
            transport.onMessage(eventType, (data: any) => {
               this.handleNetworkMessage(eventType, data);
            });
         }
      }
   }

   /**
    * Handle a network message by scheduling it or executing immediately based on timing
    * @param eventType The event type
    * @param data The message data
    */
   private handleNetworkMessage(eventType: NetworkEventType, data: any): void {
      // Get handlers for this event type
      const handlers = this.getHandlersForEventType(eventType);
      if (!handlers || handlers.size === 0) {
         console.warn(`No handlers registered for event: ${eventType}`);
         return;
      }

      if (eventType === ClientBound.UpdateAllPlayers) {
         // Add receivedAtClient timestamp to each player update
         if (Array.isArray(data)) {
            data = data.map((playerUpdate) => ({
               ...playerUpdate,
               receivedAtClient: performance.timeOrigin + performance.now(),
            }));
         }
      }

      // Get event timing classification
      const isPreGame = isPreGameEvent(eventType);
      const isHybrid = isHybridEvent(eventType);
      const gameStarted = this.isGameStarted();

      // Determine whether to process immediately or in game loop
      if (isPreGame || (isHybrid && !gameStarted)) {
         this.executeHandlers(eventType, handlers, data);
      } else {
         this.game.getPhysicsManager().scheduleTask(() => {
            this.executeHandlers(eventType, handlers, data);
         }, TaskPriority.HIGH);
      }
   }

   // Extract handler execution to reduce code duplication
   private executeHandlers(eventType: NetworkEventType, handlers: Set<NetworkMessageHandlerMetadata>, data: any): void {
      // Sort handlers by priority
      const sortedHandlers = Array.from(handlers).sort((a, b) => b.priority - a.priority);

      // Execute each handler
      for (const handler of sortedHandlers) {
         try {
            // Try the direct mapping first (fastest)
            let instance = this.handlerToInstanceMap.get(handler);

            if (!instance) {
               instance = this.getHandlerInstance(handler.target);

               // Cache the result for future lookups
               if (instance) {
                  this.handlerToInstanceMap.set(handler, instance);
               }
            }

            if (instance) {
               const method = instance[handler.propertyKey];
               if (typeof method === 'function') {
                  // Call the method with the instance as 'this'
                  method.call(instance, data);
               }
            }
         } catch (error) {
            console.error(`Error executing handler for ${eventType}:`, error);
         }
      }
   }

   /**
    * Get the appropriate set of handlers for an event type
    */
   private getHandlersForEventType(eventType: NetworkEventType): Set<NetworkMessageHandlerMetadata> | undefined {
      if (this.isClientSide()) {
         return networkMessageRegistry.clientBound.get(eventType as ClientBound);
      } else {
         return networkMessageRegistry.serverBound.get(eventType as ServerBound);
      }
   }

   /**
    * Get a handler instance based on the target
    * @param target Class, prototype or instance
    */
   private getHandlerInstance(target: any): any {
      // First check the cache
      if (this.handlerInstanceCache.has(target)) {
         return this.handlerInstanceCache.get(target);
      }

      // If target is empty object (prototype), look it up
      if (target && typeof target === 'object' && Object.keys(target).length === 0) {
         const instance = this.registeredHandlers.get(target);
         if (instance) {
            // Cache the result
            this.handlerInstanceCache.set(target, instance);
            return instance;
         }
      }

      // If target is a constructor function
      if (typeof target === 'function') {
         const className = target.name;
         const instance = this.registeredHandlers.get(className);
         if (instance) {
            // Cache the result
            this.handlerInstanceCache.set(target, instance);
            return instance;
         }
      }

      // If no instance found, cache null to avoid repeated lookups
      this.handlerInstanceCache.set(target, null);
      return null;
   }

   /**
    * Check if this is client-side code
    */
   private isClientSide(): boolean {
      return this.game.constructor.name === 'FrontendGame';
   }

   /**
    * Check if the game is started
    */
   private isGameStarted(): boolean {
      if (this.isClientSide()) {
         return (this.game as any).getPhysicsManager().isRunning();
      } else {
         return (this.game as any).isGameStarted();
      }
   }

   /**
    * Clean up the manager
    */
   public cleanup(): void {
      this.registeredHandlers.clear();
   }
}
