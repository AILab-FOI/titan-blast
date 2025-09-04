export interface ServerMetricsData {
   tps: number;
   physicsStepTimeMs: number;
   tickTimeMs: number;
   totalPlayers: number;
   memoryUsage?: number; // Optional - could add later
   timestamp: number;
}