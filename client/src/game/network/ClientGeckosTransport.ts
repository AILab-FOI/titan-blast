// client/src/game/network/ClientGeckosTransport.ts
import { BaseSocketTransport } from 'shared/game/network/BaseSocketTransport';
import geckos, { ClientChannel, Data } from '@geckos.io/client';
import { ClientBound, EventDataMap, EventReliability, ServerBound } from 'shared/game/network/SocketEvents';
import { config } from 'shared/game/SystemSettings';
import { PlayerData } from 'shared/game/PlayerData';
import { PerformanceMonitor } from '../performance/PerformanceMonitor';
import { PingManager, PingRequestData } from '../../../../shared/src/game/network/PingSystem';

export interface ClientGeckosOptions {
   gameId?: string;
   user?: PlayerData; // Add the user field
   token?: string; // Add auth token field
}

export class ClientGeckosTransport extends BaseSocketTransport {
   private channel!: ClientChannel;
   private reliableMessageTracker: Map<string, Set<string>> = new Map();
   private reliableMessageId = 0;
   private options?: ClientGeckosOptions;
   private pendingReliableMessages: Map<string, boolean> = new Map();
   private performanceMonitor?: PerformanceMonitor;
   private pingManager: PingManager = new PingManager();

   async connect(options: ClientGeckosOptions): Promise<void> {
      this.options = options; // Store options for later use

      return new Promise((resolve, reject) => {
         console.log('trying to connect to', config.ip, config.port);
         try {
            // Connect to the geckos.io server
            this.channel = geckos({
               // url: `http://${config.ip}`,
               port: config.port,
               label: 'game-1',
               authorization: options.token,
            });

            this.setupChannelListeners(resolve, reject);
         } catch (error) {
            reject(error);
         }
      });
   }

   private setupChannelListeners(resolve: () => void, reject: (error: any) => void): void {
      // Connection events
      this.channel.onConnect((error) => {
         if (error) {
            console.error('Connection error:', error);
            reject(error);
            return;
         }

         console.log('Connected to game server with Geckos.io');
         this.connected = true;
         this.notifyConnectHandlers();

         this.pingManager.setSendPingCallback((data: PingRequestData) => {
            this.broadcast(ServerBound.PingRequest, data);
         });
         this.pingManager.startPinging();

         resolve();
      });

      this.channel.onDisconnect(() => {
         console.log('Disconnected from game server');
         this.connected = false;
         this.notifyDisconnectHandlers();
      });

      // Handle normal messages
      Object.values(ClientBound).forEach((eventType) => {
         this.channel.on(eventType, (data: Data) => {
            // Check if this is a reliable message with an ID
            if (typeof data === 'object' && data && '_reliableId' in data) {
               this.handleReliableMessage(eventType, data);
            } else {
               // Regular message handling
               this.notifyMessageHandlers(eventType, data as EventDataMap[typeof eventType]);
            }
         });
      });

      // Handle special reliable message acknowledgments
      this.channel.on('_reliableAck', (ackData: Data) => {
         if (typeof ackData === 'object' && ackData && '_reliableId' in ackData) {
            const msgId = ackData._reliableId as string;

            // Mark the message as acknowledged if it's in our pending map
            if (this.pendingReliableMessages.has(msgId)) {
               this.pendingReliableMessages.set(msgId, true);
               // console.log(`📡 CLIENT: Reliable message ${msgId} acknowledged by server`);
            }
         }
      });
   }

   private handleReliableMessage(eventType: string, data: Record<string, any>): void {
      const reliableId = data._reliableId as string;
      const msgTracker = this.reliableMessageTracker.get(eventType) || new Set();

      if (this.performanceMonitor) {
         const dataSize = JSON.stringify(data).length;
         this.performanceMonitor.onNetworkDataReceived(dataSize);
      }

      // If we've already processed this message, don't process it again
      if (msgTracker.has(reliableId)) {
         // Send acknowledgment
         this.channel.emit('_reliableAck', { _reliableId: reliableId });
         return;
      }

      // Track this message as processed
      msgTracker.add(reliableId);
      this.reliableMessageTracker.set(eventType, msgTracker);

      // Clean up tracker entries older than 5 minutes
      setTimeout(
         () => {
            const tracker = this.reliableMessageTracker.get(eventType);
            if (tracker) {
               tracker.delete(reliableId);
            }
         },
         5 * 60 * 1000,
      );

      // Send acknowledgment
      this.channel.emit('_reliableAck', { _reliableId: reliableId });

      // Process the message (after removing the _reliableId field)
      const { _reliableId, ...messageData } = data;
      const actualData = messageData.data !== undefined ? messageData.data : messageData;

      // Process the message with the actual data
      this.notifyMessageHandlers(eventType as keyof EventDataMap, actualData);
   }

   disconnect(): void {
      this.channel.close();
   }

   broadcast<T extends keyof EventDataMap>(eventType: T, data: EventDataMap[T]): void {
      if (!this.connected) {
         console.warn('Attempted to send message without connection:', eventType);
         return;
      }

      const dataSize = JSON.stringify(data).length;

      // Check if this event should be sent reliably
      const reliability = EventReliability[eventType] || 'unreliable';

      if (reliability === 'reliable') {
         this.sendReliableMessage(eventType, data);
      } else {
         // For regular game updates, use unreliable transfer
         this.channel.emit(eventType, data);
      }

      if (this.performanceMonitor) {
         this.performanceMonitor.onNetworkDataSent(dataSize);
      }
   }

   private sendReliableMessage<T extends keyof EventDataMap>(eventType: T, data: EventDataMap[T]): void {
      // Generate a unique ID for this reliable message
      const reliableId = `${this.channel.id}-${Date.now()}-${this.reliableMessageId++}`;
      // console.log(`📡 CLIENT: Created reliable message with ID ${reliableId} for event ${eventType}`);

      // Add the reliable ID to the message data
      let reliableData: any;

      if (typeof data === 'object' && data !== null) {
         // Check if the data is an array
         if (Array.isArray(data)) {
            // For arrays, create a new array with the reliable ID in a wrapper object
            reliableData = {
               data: data,
               _reliableId: reliableId,
            };
         } else {
            // For regular objects, add the reliable ID directly
            reliableData = {
               ...(data as Record<string, any>),
               _reliableId: reliableId,
            };
         }
      } else {
         // Handle primitive data types
         reliableData = {
            value: data,
            _reliableId: reliableId,
         };
      }

      // Mark this message as pending acknowledgment
      this.pendingReliableMessages.set(reliableId, false);

      // Send the message
      this.channel.emit(eventType, reliableData);
      // console.log(`📡 CLIENT: Sent initial reliable message ${reliableId}`);

      // Set up retry mechanism (send up to 5 times with increasing delays)
      const maxRetries = 5;
      const baseDelay = 1000;

      let retries = 0;
      const attemptSend = () => {
         // Check if this message has been acknowledged
         const isAcknowledged = this.pendingReliableMessages.get(reliableId);

         // Stop if max retries reached or acknowledgment received
         if (retries >= maxRetries || isAcknowledged) {
            if (isAcknowledged) {
               // console.log(`📡 CLIENT: Message ${reliableId} was acknowledged, no more retries needed`);
            } else if (retries >= maxRetries) {
               // console.log(`📡 CLIENT: Max retries (${maxRetries}) reached for message ${reliableId}`);
            }

            // Remove from pending messages map after we're done with retries
            this.pendingReliableMessages.delete(reliableId);
            return;
         }

         retries++;
         // Exponential backoff
         const delay = baseDelay * Math.pow(2, retries - 1);

         setTimeout(() => {
            // Check again if message has been acknowledged before sending
            if (this.pendingReliableMessages.get(reliableId)) {
               // console.log(`📡 CLIENT: Message ${reliableId} was acknowledged, skipping retry #${retries}`);
               this.pendingReliableMessages.delete(reliableId);
               return;
            }

            if (!this.connected) {
               console.log(`📡 CLIENT: Cannot retry, connection closed for message ${reliableId}`);
               this.pendingReliableMessages.delete(reliableId);
               return;
            }

            console.log(`📡 CLIENT: Retry #${retries} for reliable message ${reliableId}`);
            this.channel.emit(eventType, reliableData);

            // Schedule next retry
            attemptSend();
         }, delay);
      };

      // Start the retry process
      attemptSend();
   }

   public setPerformanceMonitor(monitor: PerformanceMonitor): void {
      this.performanceMonitor = monitor;
   }

   public getPingManager(): PingManager {
      return this.pingManager;
   }
}
