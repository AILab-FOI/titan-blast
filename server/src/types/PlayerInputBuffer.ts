import { ServerPlayerMoveData } from './BackendPlayerMoveData';

export class PlayerInputBuffer {
   private inputBuffers: Map<string, ServerPlayerMoveData[]>;
   private readonly maxBufferSize: number;

   constructor(maxBufferSize: number = 1000) {
      this.inputBuffers = new Map<string, ServerPlayerMoveData[]>();
      this.maxBufferSize = maxBufferSize;
   }

   /**
    * Add a single input for a specific player by username
    * @param username The player's username
    * @param input The movement input data
    */
   public addInput(username: string, input: ServerPlayerMoveData): void {
      // Get or create buffer for player
      let playerBuffer = this.inputBuffers.get(username);
      if (!playerBuffer) {
         playerBuffer = [];
         this.inputBuffers.set(username, playerBuffer);
      }

      // Add input to buffer
      playerBuffer.push(input);

      // Trim buffer if it exceeds max size
      if (playerBuffer.length > this.maxBufferSize) {
         playerBuffer.shift(); // Remove oldest input
      }
   }

   /**
    * Add multiple inputs for a specific player by username
    * @param username The player's username
    * @param inputs Array of movement input data
    */
   public addInputBatch(username: string, inputs: ServerPlayerMoveData[]): void {
      inputs.forEach((input) => this.addInput(username, input));
   }

   /**
    * Get all inputs for a specific player by username
    * @param username The player's username
    * @returns Array of movement inputs or empty array if none found
    */
   public getInputs(username: string): ServerPlayerMoveData[] {
      return this.inputBuffers.get(username) || [];
   }

   /**
    * Clear all inputs for a specific player by username
    * @param username The player's username
    */
   public clearInputs(username: string): void {
      this.inputBuffers.set(username, []);
   }

   /**
    * Remove a player from the input buffer entirely
    * @param username The player's username
    */
   public removePlayer(username: string): void {
      this.inputBuffers.delete(username);
   }

   /**
    * Get inputs since a specific timestamp for a player
    * @param username The player's username
    * @param timestamp The timestamp to get inputs from
    * @returns Array of inputs since the specified timestamp
    */
   public getInputsSince(username: string, timestamp: number): ServerPlayerMoveData[] {
      const playerBuffer = this.inputBuffers.get(username);
      if (!playerBuffer) return [];

      return playerBuffer.filter((input) => input.timestamp >= timestamp);
   }

   /**
    * Get the most recent input for a player
    * @param username The player's username
    * @returns The most recent input or undefined if none exists
    */
   public getLatestInput(username: string): ServerPlayerMoveData | undefined {
      const playerBuffer = this.inputBuffers.get(username);
      if (!playerBuffer || playerBuffer.length === 0) return undefined;

      return playerBuffer[playerBuffer.length - 1];
   }

   /**
    * Check if a player has any inputs in the buffer
    * @param username The player's username
    * @returns True if the player has any inputs, false otherwise
    */
   public hasPlayer(username: string): boolean {
      return this.inputBuffers.has(username);
   }

   /**
    * Get a list of all usernames in the buffer
    * @returns Array of player usernames
    */
   public getAllPlayers(): string[] {
      return Array.from(this.inputBuffers.keys());
   }

   /**
    * Check if player has recent input within specified timeframe
    */
   public hasRecentInput(username: string, currentTime: number, timeThreshold: number = 100): boolean {
      const latestInput = this.getLatestInput(username);
      if (!latestInput) return false;

      return currentTime - latestInput.timestamp <= timeThreshold;
   }

   /**
    * Clean old inputs periodically to prevent memory buildup
    */
   public cleanOldInputs(maxAgeMs: number = 5000): void {
      const currentTime = Date.now();

      for (const [username, buffer] of this.inputBuffers) {
         const filteredBuffer = buffer.filter((input) => currentTime - input.timestamp <= maxAgeMs);
         this.inputBuffers.set(username, filteredBuffer);
      }
   }
}
