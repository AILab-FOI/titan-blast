import { NetworkMessage } from './NetworkMessage';
import { EventDataMap } from './SocketEvents';
import { NetworkEventType } from './BaseSocketTransport';

/**
 * The {@link INetworkTransport} interface defines a contract for network
 * communication. Implementations of this interface provide methods for
 * establishing and closing connections, sending messages, and registering
 * handlers for incoming messages and connection events.
 * @interface
 */
export interface INetworkTransport {
   /**
    * Establishes a connection to the specified URL.
    * @param {string} url - The URL to connect to.
    * @returns {Promise<void>} A promise that resolves when the connection is established.
    */
   connect(url: string): Promise<void>;

   /**
    * Closes the connection.
    */
   disconnect(): void;

   /**
    * Broadcasts a message to all connected clients in the game namespace.
    * Use this when you want to send information to every player in the game.
    *
    * @template T - Type parameter constrained to event types
    * @param {T} eventType - The type of event to broadcast
    * @param {EventDataMap[T]} data - The data to send to all clients
    * @returns {void}
    */
   broadcast<T extends keyof EventDataMap>(eventType: T, data: EventDataMap[T]): void;

   /**
    * Registers a handler to be called when a new message is received.
    * @param {NetworkEventType} eventType
    * @param {(message: NetworkMessage) => void} handler - The message handler to register.
    */
   onMessage<T extends keyof EventDataMap>(
      eventType: T,
      handler: (data: EventDataMap[T]) => void,
   ): void;

   /**
    * Registers a handler to be called when a connection is established.
    * @param {() => void} handler - The connection handler to register.
    */
   onConnect(handler: () => void): void;

   /**
    * Registers a handler to be called when the connection is closed.
    * @param {() => void} handler - The disconnection handler to register.
    */
   onDisconnect(handler: () => void): void;
}
