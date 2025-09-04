export interface GameStartData {
   scheduledStartTime: number; // Absolute timestamp when the game should start
   serverTick: number; // Initial server tick
   serverTime: number; // Current server time for sync
}
