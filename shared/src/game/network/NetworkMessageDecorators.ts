// shared/src/game/events/NetworkMessageDecorators.ts
import { ClientBound, ServerBound } from './SocketEvents';

export type NetworkEventType = ClientBound | ServerBound;

// Define metadata interface for network message handlers
export interface NetworkMessageHandlerMetadata {
   target: any; // The class that owns the method
   propertyKey: string; // The method name
   priority: number; // Handler priority
   preserveThis?: boolean; // Whether to preserve 'this' context
}

// Registry to store network message handlers
export interface NetworkMessageRegistry {
   clientBound: Map<ClientBound, Set<NetworkMessageHandlerMetadata>>;
   serverBound: Map<ServerBound, Set<NetworkMessageHandlerMetadata>>;
}

// Global registry for all message handlers
export const networkMessageRegistry: NetworkMessageRegistry = {
   clientBound: new Map(),
   serverBound: new Map(),
};

/**
 * Decorator for client-bound network messages (server → client)
 * @param eventType The client-bound event type
 * @param priority Optional priority (higher = runs first)
 * @param options Additional options
 */
export function OnClientMessage(
   eventType: ClientBound,
   priority: number = 0,
   options: { preserveThis?: boolean } = {},
) {
   return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      // Register the handler
      if (!networkMessageRegistry.clientBound.has(eventType)) {
         networkMessageRegistry.clientBound.set(eventType, new Set());
      }

      networkMessageRegistry.clientBound.get(eventType)!.add({
         target,
         propertyKey,
         priority,
         preserveThis: options.preserveThis !== false, // Default to true
      });

      return descriptor;
   };
}

/**
 * Decorator for server-bound network messages (client → server)
 * @param eventType The server-bound event type
 * @param priority Optional priority (higher = runs first)
 * @param options Additional options
 */
export function OnServerMessage(
   eventType: ServerBound,
   priority: number = 0,
   options: { preserveThis?: boolean } = {},
) {
   return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      // Register the handler
      if (!networkMessageRegistry.serverBound.has(eventType)) {
         networkMessageRegistry.serverBound.set(eventType, new Set());
      }

      networkMessageRegistry.serverBound.get(eventType)!.add({
         target,
         propertyKey,
         priority,
         preserveThis: options.preserveThis !== false, // Default to true
      });

      return descriptor;
   };
}
