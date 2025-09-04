import { EnemyNetworkData } from 'shared/game/enemies/EnemyInterfaces';
import { BaseEnemy } from 'shared/game/enemies/BaseEnemy';

export class EnemyDeltaManager {
   private previousStates: Map<string, Partial<EnemyNetworkData>> = new Map();

   /**
    * Get delta updates for all enemies that have changed
    */
   public getDeltaUpdates(enemies: BaseEnemy[]): Partial<EnemyNetworkData>[] {
      const deltaUpdates: Partial<EnemyNetworkData>[] = [];

      for (const enemy of enemies) {
         const currentState = this.createEnemyState(enemy);
         const previousState = this.previousStates.get(enemy.id);

         const delta = this.calculateDelta(currentState, previousState);

         if (Object.keys(delta).length > 1) {
            deltaUpdates.push(delta);
            this.previousStates.set(enemy.id, { ...currentState });
         }
      }

      return deltaUpdates;
   }

   /**
    * Create current state snapshot for an enemy
    */
   private createEnemyState(enemy: BaseEnemy): Partial<EnemyNetworkData> {
      return {
         id: enemy.id,
         position: { ...enemy.position },
         rotation: enemy.rotationDegrees,
         animationState: enemy.getAnimationState(),
         targetId: enemy.getTarget()?.id || undefined,
         lastAttackTime: (enemy as any).lastAttackTime || undefined,
      };
   }

   /**
    * Calculate delta between current and previous state
    */
   private calculateDelta(
      current: Partial<EnemyNetworkData>,
      previous?: Partial<EnemyNetworkData>,
   ): Partial<EnemyNetworkData> {
      const delta: Partial<EnemyNetworkData> = { id: current.id };

      if (!previous) {
         // No previous state, send everything except id
         return { ...current };
      }

      if (this.hasPositionChanged(current.position, previous.position)) {
         delta.position = current.position;
      }

      if (Math.abs((current.rotation || 0) - (previous.rotation || 0)) > 0.01) {
         delta.rotation = current.rotation;
      }

      if (current.animationState !== previous.animationState) {
         delta.animationState = current.animationState;
      }

      if (current.targetId !== previous.targetId) {
         delta.targetId = current.targetId;
      }

      if (current.lastAttackTime !== previous.lastAttackTime) {
         delta.lastAttackTime = current.lastAttackTime;
      }

      return delta;
   }

   /**
    * Check if position has meaningfully changed
    */
   private hasPositionChanged(current?: { x: number; y: number }, previous?: { x: number; y: number }): boolean {
      if (!current || !previous) return true;

      const threshold = 0.1; // Only send updates if moved more than 0.1 pixels
      return Math.abs(current.x - previous.x) > threshold || Math.abs(current.y - previous.y) > threshold;
   }

   /**
    * Clean up when enemy is removed
    */
   public onEnemyRemoved(enemyId: string): void {
      this.previousStates.delete(enemyId);
   }

   /**
    * Force full update for an enemy (useful for important state changes)
    */
   public forceFullUpdate(enemy: BaseEnemy): void {
      this.previousStates.delete(enemy.id);
   }

   /**
    * Get current tracking state size (for monitoring)
    */
   public getTrackingStateCount(): number {
      return this.previousStates.size;
   }
}
