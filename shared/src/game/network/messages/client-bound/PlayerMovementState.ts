export interface PlayerMovementState {
   username: string;
   position: { x: number; y: number };
   velocity: { x: number; y: number };
   timestamp: number;
   gameTick: number;

   /**
    * Defines a timestamp when client predicted this movement update locally
    *
    * Used for client reconciliation to check if client predicted state differs too much from server state
    */
   predictionTimestamp: number;

   /**
    * Defines a tick in which client predicted this movement update locally. If player movement update was
    * not caused by direct player input, defines number of ticks after last movement input
    */
   predictionTick: number;

   receivedAtClient?: number;
}
