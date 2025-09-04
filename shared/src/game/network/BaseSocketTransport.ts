import { INetworkTransport } from './INetworkTransport';
import { NetworkMessage } from './NetworkMessage';
import { ClientBound, EventDataMap, ServerBound } from './SocketEvents';

export type NetworkEventType = ClientBound | ServerBound;

/**
 * Abstract base class for network transports.  Provides common functionality
 * for handling connections, disconnections, and message dispatching.
 * Implements the {@link INetworkTransport} interface.
 *
 * @abstract
 * @implements {INetworkTransport}
 */
export abstract class BaseSocketTransport<T extends EventDataMap = EventDataMap>
   implements INetworkTransport
{
   /**
    * Array of message handlers.  These functions are called when a new
    * message is received.
    * @protected
    * @type {((message: NetworkMessage) => void)[]}
    */
   protected messageHandlers: Map<keyof T, ((data: T[keyof T]) => void)[]> = new Map();

   /**
    * Array of connect handlers. These functions are called when a
    * connection is established.
    * @protected
    * @type {(() => void)[]}
    */
   protected connectHandlers: (() => void)[] = [];

   /**
    * Array of disconnect handlers. These functions are called when a
    * connection is lost.
    * @protected
    * @type {(() => void)[]}
    */
   protected disconnectHandlers: (() => void)[] = [];

   /**
    * Indicates whether the transport is currently connected.
    * @protected
    * @type {boolean}
    */
   protected connected: boolean = false;

   /**
    * Establishes a connection to the network.
    * @abstract
    * @param {any} options - Connection options (implementation-specific).
    * @returns {Promise<void>} A promise that resolves when the connection is established.
    */
   abstract connect(options: any): Promise<void>;

   /**
    * Closes the connection to the network.
    * @abstract
    * @returns {void}
    */
   abstract disconnect(): void;

   /**
    * Broadcasts a message to all connected clients in the game namespace.
    * Use this when you want to send information to every player in the game.
    *
    * @template T - Type parameter constrained to event types
    * @param {T} eventType - The type of event to broadcast
    * @param {EventDataMap[T]} data - The data to send to all clients
    * @returns {void}
    */
   abstract broadcast<T extends keyof EventDataMap>(eventType: T, data: EventDataMap[T]): void;

   /**
    * Registers a handler for incoming messages.
    * @public
    * @param {NetworkEventType} eventType
    * @param {((message: NetworkMessage) => void)} handler - The message handler function.
    * @returns {void}
    */
   public onMessage<K extends keyof T>(eventType: K, handler: (data: T[K]) => void): void {
      if (!this.messageHandlers.has(eventType)) {
         this.messageHandlers.set(eventType, []);
      }
      this.messageHandlers.get(eventType)!.push(handler as (data: T[keyof T]) => void);
   }

   /**
    * Registers a handler for connection events.  If already connected, the
    * handler is called immediately.
    * @public
    * @param {() => void} handler - The connection handler function.
    * @returns {void}
    */
   public onConnect(handler: () => void): void {
      this.connectHandlers.push(handler);
      if (this.connected) {
         handler();
      }
   }

   /**
    * Registers a handler for disconnection events.
    * @public
    * @param {() => void} handler - The disconnection handler function.
    * @returns {void}
    */
   public onDisconnect(handler: () => void): void {
      this.disconnectHandlers.push(handler);
   }

   /**
    * Emits a message to all registered message handlers.
    * @protected
    * @returns {void}
    * @param {NetworkEventType} eventType
    * @param data
    */
   protected notifyMessageHandlers<K extends keyof T>(eventType: K, data: T[K]): void {
      const handlers = this.messageHandlers.get(eventType);
      if (handlers) {
         handlers.forEach((handler) => handler(data));
      }
   }

   /**
    * Emits a connection event to all registered connection handlers.
    * Sets the `connected` flag to `true`.
    * @protected
    * @returns {void}
    */
   protected notifyConnectHandlers(): void {
      this.connected = true;
      this.connectHandlers.forEach((handler) => handler());
   }

   /**
    * Emits a disconnection event to all registered disconnection handlers.
    * Sets the `connected` flag to `false`.
    * @protected
    * @returns {void}
    */
   protected notifyDisconnectHandlers(): void {
      this.connected = false;
      this.disconnectHandlers.forEach((handler) => handler());
   }
}
