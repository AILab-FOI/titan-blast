// shared/src/game/enemies/EnemyTargetSystem.ts - Better targeting approach

import { Position } from '../Position';
import { Player } from '../Player';
import { MathUtil } from '../../util/MathUtil';

/**
 * Simple interface for entities that can be targeted by enemies
 * Back to having targetPriority for priority-based targeting
 */
export interface ITargetable {
   readonly id: string;
   readonly targetType: TargetType;
   readonly targetPriority: number; // Higher = more priority (for priority targeting)

   getCurrentPosition(): Position;
}

/**
 * Types of targets enemies can pursue
 */
export enum TargetType {
   PLAYER = 'player',
   STRUCTURE = 'structure',
   RESOURCE = 'resource',
   OBJECTIVE = 'objective',
}

/**
 * Targeting strategies enemies can use
 */
export enum TargetingStrategy {
   CLOSEST_PLAYER = 'closest_player',
   PRIORITY_PLAYER = 'priority_player',
   PRIORITY_STRUCTURE = 'priority_structure',
   CLOSEST_ANY = 'closest_any',
   PRIORITY_ANY = 'priority_any',
}

/**
 * Target finder - finds a single target based on strategy
 * No more getting all targets and filtering!
 */
export class TargetFinder {
   /**
    * Find single target based on strategy
    * This replaces the old getAvailableTargets() approach
    */
   static findTarget(
      strategy: TargetingStrategy,
      enemyPosition: Position,
      maxDistance: number,
      availableEntities: { players: any[]; structures?: any[] },
   ): ITargetable | null {
      switch (strategy) {
         case TargetingStrategy.CLOSEST_PLAYER:
            return this.findClosestPlayer(enemyPosition, maxDistance, availableEntities.players);

         case TargetingStrategy.PRIORITY_PLAYER:
            return this.findPriorityPlayer(enemyPosition, maxDistance, availableEntities.players);

         case TargetingStrategy.PRIORITY_STRUCTURE:
            return this.findPriorityStructure(enemyPosition, maxDistance, availableEntities.structures || []);

         case TargetingStrategy.CLOSEST_ANY:
            return this.findClosestAny(enemyPosition, maxDistance, availableEntities);

         case TargetingStrategy.PRIORITY_ANY:
            return this.findPriorityAny(enemyPosition, maxDistance, availableEntities);

         default:
            return null;
      }
   }

   /**
    * Find closest player within range
    */
   private static findClosestPlayer(
      enemyPosition: Position,
      maxDistance: number,
      players: Player[],
   ): ITargetable | null {
      let closestPlayer: any = null;
      let closestDistance = maxDistance;

      for (const player of players) {
         const distance = MathUtil.distance(enemyPosition, player.position);
         if (distance < closestDistance) {
            closestDistance = distance;
            closestPlayer = player;
         }
      }

      return closestPlayer ? this.playerToTarget(closestPlayer) : null;
   }

   /**
    * Find highest priority player within range
    */
   private static findPriorityPlayer(enemyPosition: Position, maxDistance: number, players: any[]): ITargetable | null {
      let bestPlayer: any = null;
      let bestPriority = 0;

      for (const player of players) {
         const distance = MathUtil.distance(enemyPosition, player.position);
         if (distance > maxDistance) continue;

         // Get player priority (could be based on health, level, threat, etc.)
         const priority = this.getPlayerPriority(player);
         if (priority > bestPriority) {
            bestPriority = priority;
            bestPlayer = player;
         }
      }

      return bestPlayer ? this.playerToTarget(bestPlayer) : null;
   }

   /**
    * Find highest priority structure within range
    */
   private static findPriorityStructure(
      enemyPosition: Position,
      maxDistance: number,
      structures: any[],
   ): ITargetable | null {
      // TODO: Implement when structures exist
      // For now, return null
      return null;

      // Future implementation:
      // let bestStructure: any = null;
      // let bestPriority = 0;
      //
      // for (const structure of structures) {
      //    const distance = this.getDistance(enemyPosition, structure.position);
      //    if (distance > maxDistance) continue;
      //    if (structure.isDestroyed) continue;
      //
      //    const priority = this.getStructurePriority(structure);
      //    if (priority > bestPriority) {
      //       bestPriority = priority;
      //       bestStructure = structure;
      //    }
      // }
      //
      // return bestStructure ? this.structureToTarget(bestStructure) : null;
   }

   /**
    * Find closest target of any type
    */
   private static findClosestAny(
      enemyPosition: Position,
      maxDistance: number,
      availableEntities: { players: any[]; structures?: any[] },
   ): ITargetable | null {
      let closestTarget: ITargetable | null = null;
      let closestDistance = maxDistance;

      // Check players
      const closestPlayer = this.findClosestPlayer(enemyPosition, maxDistance, availableEntities.players);
      if (closestPlayer) {
         const distance = MathUtil.distance(enemyPosition, closestPlayer.getCurrentPosition());
         if (distance < closestDistance) {
            closestDistance = distance;
            closestTarget = closestPlayer;
         }
      }

      // TODO: Check structures when implemented

      return closestTarget;
   }

   /**
    * Find highest priority target of any type
    */
   private static findPriorityAny(
      enemyPosition: Position,
      maxDistance: number,
      availableEntities: { players: any[]; structures?: any[] },
   ): ITargetable | null {
      let bestTarget: ITargetable | null = null;
      let bestPriority = 0;

      // Check players
      const priorityPlayer = this.findPriorityPlayer(enemyPosition, maxDistance, availableEntities.players);
      if (priorityPlayer && priorityPlayer.targetPriority > bestPriority) {
         bestPriority = priorityPlayer.targetPriority;
         bestTarget = priorityPlayer;
      }

      // TODO: Check structures when implemented

      return bestTarget;
   }

   /**
    * Convert player object to ITargetable (now with live position tracking)
    */
   private static playerToTarget(player: Player): ITargetable {
      return {
         id: player.id,
         targetType: TargetType.PLAYER,
         targetPriority: this.getPlayerPriority(player),
         // This ensures we always get the CURRENT position, not a snapshot!
         getCurrentPosition: () => player.position,
      };
   }

   /**
    * Get player priority for targeting
    * This determines which players are more attractive targets
    */
   private static getPlayerPriority(player: Player): number {
      let priority = 10; // Base priority

      // Lower health = higher priority (easier to kill)
      if (player.health && player.maxHealth) {
         const healthPercent = player.health / player.maxHealth;
         priority += (1 - healthPercent) * 5; // Up to +5 for low health
      }

      // TODO: Add more priority factors:
      // - Player level/threat
      // - Whether player is attacking us
      // - Whether player has valuable items
      // - Whether player is isolated vs grouped

      return priority;
   }
}
