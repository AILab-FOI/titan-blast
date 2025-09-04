// server/src/network/ServerGeckosTransport.ts
import { EventDataMap, EventReliability, ServerBound } from 'shared/game/network/SocketEvents';
import geckos, { Data, GeckosServer, iceServers, ServerChannel } from '@geckos.io/server';
import { BaseSocketTransport } from 'shared/game/network/BaseSocketTransport';
import { ServerEventDataMap } from './ServerEventTypes';
import http from 'http';
import { CorsOptions as GeckosCorsOptions } from '@geckos.io/common/lib/types';
import express from 'express';
import { geckosAuthMiddleware } from 'src/middleware/AuthMiddleware';

export interface ServerGeckosOptions {
   server?: http.Server;
   port?: number;
   gameId: string;
   cors?: GeckosCorsOptions;
}

export class ServerGeckosTransport extends BaseSocketTransport<ServerEventDataMap> {
   private io!: GeckosServer;
   private server: http.Server | null = null;
   private app: express.Express | null = null;
   private gameId!: string;
   private channels: Map<string, ServerChannel> = new Map();
   private reliableMessageTracker: Map<string, Set<string>> = new Map();
   private reliableMessageId = 0;
   private port: number = 0;
   private pendingReliableMessages: Map<string, boolean> = new Map();
   private playerToChannelMap: Map<string, string> = new Map();

   /**
    * Connect to the geckos.io server
    * @param options Server connection options
    */
   async connect(options: ServerGeckosOptions): Promise<void> {
      this.port = options.port! || 3000;

      // Create geckos.io server
      this.io = geckos({
         iceServers: process.env.NODE_ENV === 'production' ? iceServers : [],
         portRange: {
            min: 10000,
            max: 10007,
         },
         cors: {
            allowAuthorization: options.cors?.allowAuthorization ?? true,
            origin: options.cors?.origin ?? '*',
         },
         multiplex: true, // Use multiplexing for better connection handling
         label: options.gameId || 'default-game',
         authorization: geckosAuthMiddleware,
      });

      if (options.server) {
         this.server = options.server;

         // Add the server to geckos
         this.io.addServer(this.server);
         console.log(`Added existing HTTP server to geckos.io`);
      }
      else {
         this.app = express();

         // const allowedOrigins = options.cors?.origin;

         // Configure CORS
         // this.app.use(
         //    cors({
         //       origin: Array.isArray(allowedOrigins)
         //          ? allowedOrigins.filter((o): o is string | RegExp | boolean => typeof o !== 'function')
         //          : typeof allowedOrigins === 'function'
         //             ? allowedOrigins // use function directly
         //             : [allowedOrigins || 'http://localhost:9000'],
         //       methods: ['GET', 'POST', 'OPTIONS'],
         //       allowedHeaders: ['Content-Type', 'Authorization'],
         //       credentials: true,
         //    }));

         // Create HTTP server
         this.server = http.createServer(this.app);

         // Add the server to geckos
         this.io.addServer(this.server);

         // Start listening
         this.server.listen(this.port, () => {
            console.log(`HTTP server started on port ${this.port}`);
         });

         // Add a simple health check route
         this.app.get('/', (req, res) => {
            res.send('Game server is running');
         });

         console.log(`Created new HTTP server and added to geckos.io`);
      }

      this.setupConnectionHandler();

      this.notifyConnectHandlers();

      console.log('ServerGeckosTransport initialized successfully');
      return Promise.resolve();
   }

   private setupConnectionHandler(): void {
      this.io.onConnection((channel: ServerChannel) => {
         console.log(`Player connected to game ${this.gameId} with channel ID ${channel.id}`);

         if (channel.id) {
            const channelId = channel.id.toString();
            this.channels.set(channelId, channel);

            console.log('Channel userData from auth:', channel.userData);

            if (channel.userData && channel.userData.username) {
               const username = channel.userData.username;
               console.log(`Mapping username ${username} to channel ID ${channelId}`);
               this.playerToChannelMap.set(username, channelId);
            }
         }

         // Set up listeners for all server-bound events
         Object.values(ServerBound).forEach((eventType) => {
            channel.on(eventType, (data: Data) => {
               if (typeof data === 'object' && data && '_reliableId' in data) {
                  this.handleReliableMessage(channel, eventType, data as Record<string, any>);
               } else {
                  // Add channel and player info to data for server-side handling
                  this.handleRegularMessage(channel, eventType, data);
               }
            });
         });

         channel.on('_reliableAck', (ackData: Data) => {
            if (typeof ackData === 'object' && ackData && '_reliableId' in ackData) {
               const msgId = ackData._reliableId as string;

               if (this.pendingReliableMessages.has(msgId)) {
                  this.pendingReliableMessages.set(msgId, true);
                  // console.log(`📡 SERVER: Reliable message ${msgId} acknowledged by client ${channel.id}`);
               }
            }
         });

         // Handle disconnection
         channel.onDisconnect((reason) => {
            if (channel.id) {
               const channelId = channel.id.toString();
               console.log(`Player disconnected from channel ${channelId}: ${reason}`);

               const username = channel.userData?.username;

               this.channels.delete(channelId);

               if (username) {
                  console.log(`Removing mapping for player ${username}`);
                  this.playerToChannelMap.delete(username);
               }

               this.notifyMessageHandlers(ServerBound.PlayerDisconnect, {
                  username,
                  reason,
                  channelId: channel.id,
               });
            }
         });
      });
   }

   private handleRegularMessage(channel: ServerChannel, eventType: string, data: Data): void {
      let enrichedData: any;

      if (typeof data === 'object' && data !== null) {
         enrichedData = {
            ...(data as Record<string, any>),
            username: channel.userData?.username,
            channelId: channel.id,
         };
      } else {
         enrichedData = {
            value: data,
            username: channel.userData?.username,
            channelId: channel.id,
         };
      }

      this.notifyMessageHandlers(eventType as keyof EventDataMap, enrichedData);
   }

   private handleReliableMessage(channel: ServerChannel, eventType: string, data: Record<string, any>): void {
      const reliableId = data._reliableId as string;
      const msgTracker = this.reliableMessageTracker.get(eventType) || new Set();

      if (msgTracker.has(reliableId)) {
         // Send acknowledgment
         channel.emit('_reliableAck', { _reliableId: reliableId });
         return;
      }

      msgTracker.add(reliableId);
      this.reliableMessageTracker.set(eventType, msgTracker);

      setTimeout(
         () => {
            const tracker = this.reliableMessageTracker.get(eventType);
            if (tracker) {
               tracker.delete(reliableId);
            }
         },
         5 * 60 * 1000,
      );

      channel.emit('_reliableAck', { _reliableId: reliableId });

      const { _reliableId, ...messageData } = data;

      const actualData = messageData.data !== undefined ? messageData.data : messageData;

      let enrichedData: any;

      if (Array.isArray(actualData)) {
         enrichedData = {
            value: actualData,
            username: channel.userData?.username,
            channelId: channel.id,
         };
      } else if (typeof actualData === 'object' && actualData !== null) {
         // For regular objects, spread the properties
         enrichedData = {
            ...(actualData as Record<string, any>),
            username: channel.userData?.username,
            channelId: channel.id,
         };
      } else {
         // For primitive types, create a new object
         enrichedData = {
            value: actualData,
            username: channel.userData?.username,
            channelId: channel.id,
         };
      }

      this.notifyMessageHandlers(eventType as keyof EventDataMap, enrichedData);
   }

   broadcast<T extends keyof EventDataMap>(eventType: T, data: EventDataMap[T]): void {
      const reliability = EventReliability[eventType] || 'unreliable';

      if (reliability === 'reliable') {
         // For reliable broadcasts, we need to send to each channel individually
         for (const channel of this.channels.values()) {
            this.sendReliableMessage(channel, eventType, data);
         }
      } else {
         // For unreliable broadcasts, we can use the built-in emit
         this.io.emit(eventType as string, data);
      }
   }

   sendToPlayer<T extends keyof EventDataMap>(username: string, eventType: T, data: EventDataMap[T]): void {
      const targetChannel = this.getChannelByPlayerUsername(username);

      if (targetChannel) {
         const reliability = EventReliability[eventType] || 'unreliable';

         if (reliability === 'reliable') {
            this.sendReliableMessage(targetChannel, eventType, data);
         } else {
            targetChannel.emit(eventType as string, data);
         }
      } else {
         console.warn(`Cannot send to player ${username}: channel not found`);
      }
   }

   broadcastExcept<T extends keyof EventDataMap>(excludeUsername: string, eventType: T, data: EventDataMap[T]): void {
      const reliability = EventReliability[eventType] || 'unreliable';

      // Find all channels except the excluded one
      for (const channel of this.channels.values()) {
         if (channel.userData?.username !== excludeUsername) {
            if (reliability === 'reliable') {
               this.sendReliableMessage(channel, eventType, data);
            } else {
               channel.emit(eventType as string, data);
            }
         }
      }
   }

   private sendReliableMessage<T extends keyof EventDataMap>(
      channel: ServerChannel,
      eventType: T,
      data: EventDataMap[T],
   ): void {
      // Generate a unique ID for this reliable message
      const reliableId = `server-${Date.now()}-${this.reliableMessageId++}`;
      // console.log(
      //    // `📡 SERVER: Created reliable message with ID ${reliableId} for event ${eventType} to channel ${channel.id}`,
      // );

      let reliableData: any;

      if (typeof data === 'object' && data !== null) {
         if (Array.isArray(data)) {
            reliableData = {
               data: data,
               _reliableId: reliableId,
            };
         } else {
            reliableData = {
               ...(data as Record<string, any>),
               _reliableId: reliableId,
            };
         }
      } else {
         reliableData = {
            value: data,
            _reliableId: reliableId,
         };
      }

      this.pendingReliableMessages.set(reliableId, false);

      channel.emit(eventType as string, reliableData);
      // console.log(`📡 SERVER: Sent initial reliable message ${reliableId} to channel ${channel.id}`);

      // Set up retry mechanism
      const maxRetries = 5;
      const baseDelay = 1000;
      let retries = 0;

      const attemptSend = () => {
         // Check if this message has been acknowledged
         const isAcknowledged = this.pendingReliableMessages.get(reliableId);

         // Stop if max retries reached or acknowledgment received
         if (retries >= maxRetries || isAcknowledged) {
            if (isAcknowledged) {
               console.log(`📡 SERVER: Message ${reliableId} was acknowledged, no more retries needed`);
            } else if (retries >= maxRetries) {
               console.log(`📡 SERVER: Max retries (${maxRetries}) reached for message ${reliableId}`);
            }

            // Remove from pending messages map after we're done with retries
            this.pendingReliableMessages.delete(reliableId);
            return;
         }

         retries++;
         const delay = baseDelay * Math.pow(2, retries - 1);

         setTimeout(() => {
            // Check again if message has been acknowledged before sending
            if (this.pendingReliableMessages.get(reliableId)) {
               // console.log(`📡 SERVER: Message ${reliableId} was acknowledged, skipping retry #${retries}`);
               this.pendingReliableMessages.delete(reliableId);
               return;
            }

            // Also check if channel is still valid
            if (!this.channels.has(channel.id?.toString() || '')) {
               console.log(`📡 SERVER: Cannot retry, channel ${channel.id} no longer exists`);
               this.pendingReliableMessages.delete(reliableId);
               return;
            }

            console.log(`📡 SERVER: Retry #${retries} for reliable message ${reliableId} to channel ${channel.id}`);
            channel.emit(eventType as string, reliableData);

            // Schedule next retry
            attemptSend();
         }, delay);
      };

      // Start the retry process
      attemptSend();
   }

   disconnect(): void {
      // Close all connections
      this.channels.forEach((channel) => {
         channel.close();
      });

      this.channels.clear();
      this.playerToChannelMap.clear();
   }

   /**
    * Get channel for a player by username
    * @param username The player's username
    * @returns ServerChannel or undefined if not found
    */
   getChannelByPlayerUsername(username: string): ServerChannel | undefined {
      const channelId = this.playerToChannelMap.get(username);
      if (channelId) {
         return this.channels.get(channelId);
      }
      return undefined;
   }

   /**
    * Get channel by channel ID
    * @param channelId Channel ID
    * @returns ServerChannel or undefined if not found
    */
   getChannel(channelId: string): ServerChannel | undefined {
      return this.channels.get(channelId);
   }
}
