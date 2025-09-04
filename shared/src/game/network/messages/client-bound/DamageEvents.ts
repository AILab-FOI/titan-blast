/**
 * Immediate damage event data sent to clients for visual feedback
 */
export interface EnemyDamageEvent {
   targetId: string;
   damage: number;
   position: { x: number; y: number };
   armorReduction: number;
   distanceReduction: number;
   sourceGunType: string;
   timestamp: number;
}

/**
 * Batch of damage events sent together
 */
export interface EnemyDamageEventBatch {
   events: EnemyDamageEvent[];
   tick: number;
   timestamp: number;
}
