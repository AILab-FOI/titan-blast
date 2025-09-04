// shared/src/game/network/PingSystem.ts

export interface PingRequestData {
   clientTimestamp: number;
   requestId: string;
}

export interface PingResponseData {
   clientTimestamp: number;
   serverTimestamp: number;
   requestId: string;
}

export class PingManager {
   private pendingPings: Map<string, number> = new Map();
   private pingHistory: number[] = [];
   private readonly maxPingHistory = 10;
   private currentPing: number = 0;
   private averagePing: number = 0;

   private pingInterval: NodeJS.Timeout | null = null;
   private readonly pingIntervalMs = 2000; // Ping every 2 seconds

   private sendPingCallback?: (data: PingRequestData) => void;

   constructor() {}

   /**
    * Set the callback function for sending ping requests
    */
   public setSendPingCallback(callback: (data: PingRequestData) => void): void {
      this.sendPingCallback = callback;
   }

   /**
    * Start periodic ping measurements
    */
   public startPinging(): void {
      if (this.pingInterval) return;

      this.pingInterval = setInterval(() => {
         this.sendPing();
      }, this.pingIntervalMs);

      // Send initial ping immediately
      this.sendPing();
   }

   /**
    * Stop periodic ping measurements
    */
   public stopPinging(): void {
      if (this.pingInterval) {
         clearInterval(this.pingInterval);
         this.pingInterval = null;
      }
   }

   /**
    * Send a ping request to the server
    */
   private sendPing(): void {
      if (!this.sendPingCallback) return;

      const requestId = `ping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const clientTimestamp = performance.now();

      this.pendingPings.set(requestId, clientTimestamp);

      // Clean up old pending pings (older than 10 seconds)
      const now = performance.now();
      for (const [id, timestamp] of this.pendingPings.entries()) {
         if (now - timestamp > 10000) {
            this.pendingPings.delete(id);
         }
      }

      this.sendPingCallback({
         clientTimestamp,
         requestId,
      });
   }

   /**
    * Handle ping response from server
    */
   public handlePingResponse(response: PingResponseData): void {
      const sendTime = this.pendingPings.get(response.requestId);
      if (!sendTime) {
         console.warn('Received ping response for unknown request:', response.requestId);
         return;
      }

      this.pendingPings.delete(response.requestId);

      const receiveTime = performance.now();
      const roundTripTime = receiveTime - sendTime;

      // Store the ping measurement
      this.currentPing = roundTripTime;
      this.pingHistory.push(roundTripTime);

      // Keep only the most recent ping measurements
      if (this.pingHistory.length > this.maxPingHistory) {
         this.pingHistory.shift();
      }

      // Calculate average ping
      this.averagePing = this.pingHistory.reduce((sum, ping) => sum + ping, 0) / this.pingHistory.length;
   }

   /**
    * Get current ping in milliseconds
    */
   public getCurrentPing(): number {
      return this.currentPing;
   }

   /**
    * Get average ping in milliseconds
    */
   public getAveragePing(): number {
      return this.averagePing;
   }

   /**
    * Get ping stability (lower is more stable)
    * Returns standard deviation of recent pings
    */
   public getPingStability(): number {
      if (this.pingHistory.length < 2) return 0;

      const mean = this.averagePing;
      const variance =
         this.pingHistory.reduce((sum, ping) => {
            const diff = ping - mean;
            return sum + diff * diff;
         }, 0) / this.pingHistory.length;

      return Math.sqrt(variance);
   }

   /**
    * Cleanup when destroying the ping manager
    */
   public destroy(): void {
      this.stopPinging();
      this.pendingPings.clear();
      this.pingHistory = [];
   }
}
