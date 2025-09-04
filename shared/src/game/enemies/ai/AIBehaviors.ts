// shared/src/game/enemies/ai/AIBehaviors.ts

import { AIBehaviorType, IAIBehavior } from '../EnemyInterfaces';
import { Position } from '../../Position';
import { ITargetable, TargetType } from '../EnemyTargetSystem';
import { MathUtil } from '../../../util/MathUtil';
import { SteeringController } from '../steering/SteeringController';
import { SteeringConfigBuilder } from '../steering/SteeringConfigBuilder';

/**
 * Basic chase AI - moves directly toward the nearest target
 */
export class BasicChaseAI implements IAIBehavior {
   public readonly type = AIBehaviorType.BASIC_CHASE;

   /**
    * New single-target approach - much simpler!
    */
   public updateWithTarget(enemy: any, deltaTime: number, target: ITargetable): void {
      // Get CURRENT position and use MathUtils
      const targetPosition = target.getCurrentPosition();
      const distance = MathUtil.distance(enemy.position, targetPosition);

      // Try to attack if in range
      if (distance <= enemy.properties.attackRange) {
         enemy.attackTarget(target);
      } else {
         // Move towards target's CURRENT position
         enemy.moveTowardsWithForce(targetPosition, deltaTime);
      }
   }

   // Legacy method for backward compatibility
   public update(enemy: any, deltaTime: number, targets: ITargetable[]): void {
      if (targets.length > 0) {
         this.updateWithTarget(enemy, deltaTime, targets[0]);
      }
   }

   public onDamaged(enemy: any, damage: number, source: any): void {
      if (source && source.id && source.position) {
         const targetableSource: ITargetable = {
            id: source.id,
            targetType: TargetType.PLAYER,
            targetPriority: 20,
            // Use live position tracking
            getCurrentPosition: () => source.position,
         };
         enemy.setTarget(targetableSource);
      }
   }

   public createSteeringConfig(): SteeringController {
      return SteeringConfigBuilder.create()
         .withSeparation({
            radius: 60,
            strength: 20,
            maxForce: 25,
            updateFrequency: 150,
         })
         .build();
   }

   public onTargetLost(enemy: any): void {
      enemy.setTarget(null);
   }
}

/**
 * Strategic AI - targets important structures and moves unpredictably
 */
/**
 * Strategic AI - targets important structures and moves unpredictably
 */
export class StrategicAI implements IAIBehavior {
   public readonly type = AIBehaviorType.STRATEGIC;

   private lastDirectionChange: number = 0;
   private currentDirection: { x: number; y: number } = { x: 0, y: 0 };
   private directionChangeInterval: number = 2000; // Change direction every 2 seconds

   /**
    * Strategic movement with unpredictable patterns
    */
   public updateWithTarget(enemy: any, deltaTime: number, target: ITargetable): void {
      // Get CURRENT position and use MathUtils
      const targetPosition = target.getCurrentPosition();
      const distance = MathUtil.distance(enemy.position, targetPosition);

      if (distance <= enemy.properties.attackRange) {
         enemy.attackTarget(target);
      } else {
         this.moveUnpredictablyWithForce(enemy, targetPosition, Date.now(), deltaTime);
      }
   }

   private moveUnpredictablyWithForce(
      enemy: any,
      targetPosition: Position,
      currentTime: number,
      deltaTime: number,
   ): void {
      // Change direction periodically for unpredictable movement
      if (currentTime - this.lastDirectionChange > this.directionChangeInterval) {
         this.generateNewDirection(enemy, targetPosition);
         this.lastDirectionChange = currentTime;
      }

      // Apply force in current direction
      const moveSpeed = enemy.properties.movementSpeed * (1 + (enemy.level - 1) * 0.1);
      const forceMagnitude = moveSpeed * enemy.properties.physics.mass;

      const force = {
         x: this.currentDirection.x * forceMagnitude * deltaTime,
         y: this.currentDirection.y * forceMagnitude * deltaTime,
      };

      enemy.applyForce(force);
   }

   private generateNewDirection(enemy: any, targetPosition: Position): void {
      const dx = targetPosition.x - enemy.position.x;
      const dy = targetPosition.y - enemy.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance === 0) {
         this.currentDirection = { x: 0, y: 0 };
         return;
      }

      // Base direction towards target
      const baseX = dx / distance;
      const baseY = dy / distance;

      // Add random offset for unpredictability
      const randomAngle = ((Math.random() - 0.5) * Math.PI) / 2; // ±45 degrees
      const cos = Math.cos(randomAngle);
      const sin = Math.sin(randomAngle);

      this.currentDirection = {
         x: baseX * cos - baseY * sin,
         y: baseX * sin + baseY * cos,
      };
   }

   // public onDamaged(enemy: any, damage: number, source: any): void {
   //    // When damaged, immediately change direction and target source
   //    if (source && source.position) {
   //       const targetableSource: ITargetable = {
   //          id: source.id || 'unknown',
   //          position: source.position,
   //          targetType: TargetType.PLAYER,
   //          targetPriority: 15,
   //       };
   //
   //       enemy.setTarget(targetableSource);
   //       this.generateNewDirection(enemy, source.position);
   //       this.lastDirectionChange = Date.now();
   //    }
   // }

   public onTargetLost(enemy: any): void {
      enemy.setTarget(null);
   }
}

/**
 * Defensive AI - stays back and attacks from range
 */
export class DefensiveAI implements IAIBehavior {
   public readonly type = AIBehaviorType.DEFENSIVE;

   private preferredDistance: number = 150; // Stay at this distance from target

   /**
    * Defensive behavior - maintain distance while attacking
    */
   public updateWithTarget(enemy: any, deltaTime: number, target: ITargetable): void {
      const targetPosition = target.getCurrentPosition();
      const distance = MathUtil.distance(enemy.position, targetPosition);

      // Try to attack if in range
      if (distance <= enemy.properties.attackRange) {
         enemy.attackTarget(target);
      }

      // Maintain preferred distance
      if (distance < this.preferredDistance) {
         // Too close - move away using force
         this.moveAwayFromWithForce(enemy, targetPosition, deltaTime);
      } else if (distance > enemy.properties.attackRange) {
         // Too far - move closer but not too close
         this.moveTowardsButKeepDistanceWithForce(enemy, targetPosition, deltaTime);
      }
   }

   private moveAwayFromWithForce(enemy: any, targetPosition: Position, deltaTime: number): void {
      const dx = enemy.position.x - targetPosition.x;
      const dy = enemy.position.y - targetPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
         const normalizedX = dx / distance;
         const normalizedY = dy / distance;

         // Move slower when retreating
         const moveSpeed = enemy.properties.movementSpeed * 0.8;
         const forceMagnitude = moveSpeed * enemy.properties.physics.mass;

         const force = {
            x: normalizedX * forceMagnitude * deltaTime,
            y: normalizedY * forceMagnitude * deltaTime,
         };

         enemy.applyForce(force);
      }
   }

   private moveTowardsButKeepDistanceWithForce(enemy: any, targetPosition: Position, deltaTime: number): void {
      const dx = targetPosition.x - enemy.position.x;
      const dy = targetPosition.y - targetPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > this.preferredDistance) {
         const normalizedX = dx / distance;
         const normalizedY = dy / distance;

         // Move at reduced speed to maintain distance
         const moveSpeed = enemy.properties.movementSpeed * 0.6;
         const forceMagnitude = moveSpeed * enemy.properties.physics.mass;

         const force = {
            x: normalizedX * forceMagnitude * deltaTime,
            y: normalizedY * forceMagnitude * deltaTime,
         };

         enemy.applyForce(force);
      }
   }

   // public onDamaged(enemy: any, damage: number, source: any): void {
   //    // Defensive enemies try to flee when damaged
   //    if (source && source.position) {
   //       const targetableSource: ITargetable = {
   //          id: source.id || 'unknown',
   //          position: source.position,
   //          targetType: TargetType.PLAYER,
   //          targetPriority: 5, // Lower priority, prefer to flee
   //       };
   //
   //       enemy.setTarget(targetableSource);
   //
   //       // Increase preferred distance when damaged
   //       this.preferredDistance = Math.min(300, this.preferredDistance * 1.5);
   //    }
   // }

   public onTargetLost(enemy: any): void {
      enemy.setTarget(null);
      // Reset preferred distance
      this.preferredDistance = 150;
   }
}

/**
 * Swarm AI - coordinates with nearby enemies for group attacks
 */
export class SwarmAI implements IAIBehavior {
   public readonly type = AIBehaviorType.SWARM;

   private swarmRadius: number = 200; // Distance to look for nearby allies

   /**
    * Swarm behavior - coordinate with nearby enemies
    */
   public updateWithTarget(enemy: any, deltaTime: number, target: ITargetable): void {
      const targetPosition = target.getCurrentPosition();
      const distance = MathUtil.distance(enemy.position, targetPosition);

      // Try to attack if in range
      if (distance <= enemy.properties.attackRange) {
         enemy.attackTarget(target);
      } else {
         // Move as part of swarm using coordinated force
         this.moveWithSwarmForce(enemy, targetPosition, deltaTime);
      }
   }

   private moveWithSwarmForce(enemy: any, targetPosition: Position, deltaTime: number): void {
      // Calculate direction to target
      const dx = targetPosition.x - enemy.position.x;
      const dy = targetPosition.y - enemy.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance === 0) return;

      const targetDirection = {
         x: dx / distance,
         y: dy / distance,
      };

      // TODO: Get nearby enemies from enemy manager for true swarm behavior
      // For now, just use basic target direction with slight randomization
      const swarmDirection = {
         x: targetDirection.x + (Math.random() - 0.5) * 0.3,
         y: targetDirection.y + (Math.random() - 0.5) * 0.3,
      };

      // Normalize swarm direction
      const swarmDistance = Math.sqrt(swarmDirection.x * swarmDirection.x + swarmDirection.y * swarmDirection.y);
      if (swarmDistance > 0) {
         swarmDirection.x /= swarmDistance;
         swarmDirection.y /= swarmDistance;
      }

      // Apply swarm movement force
      const moveSpeed = enemy.properties.movementSpeed * (1 + (enemy.level - 1) * 0.1);
      const forceMagnitude = moveSpeed * enemy.properties.physics.mass;

      const force = {
         x: swarmDirection.x * forceMagnitude * deltaTime,
         y: swarmDirection.y * forceMagnitude * deltaTime,
      };

      enemy.applyForce(force);
   }

   // public onDamaged(enemy: any, damage: number, source: any): void {
   //    // Swarm enemies call for help when damaged
   //    if (source && source.position) {
   //       const targetableSource: ITargetable = {
   //          id: source.id || 'unknown',
   //          position: source.position,
   //          targetType: TargetType.PLAYER,
   //          targetPriority: 12, // High priority for group attacks
   //       };
   //
   //       enemy.setTarget(targetableSource);
   //
   //       // TODO: Notify nearby enemies to also target this source
   //    }
   // }

   public onTargetLost(enemy: any): void {
      enemy.setTarget(null);
   }
}

/**
 * Ghost AI - can move through walls and obstacles
 */
export class GhostPhaseAI implements IAIBehavior {
   public readonly type = AIBehaviorType.GHOST_PHASE;

   /**
    * Ghost behavior - direct movement through obstacles
    */
   public updateWithTarget(enemy: any, deltaTime: number, target: ITargetable): void {
      // Ghosts only target players (ignore structures due to phasing)
      if (target.targetType !== TargetType.PLAYER) {
         enemy.setTarget(null);
         return;
      }

      const targetPosition = target.getCurrentPosition();
      const distance = MathUtil.distance(enemy.position, targetPosition);

      if (distance <= enemy.properties.attackRange) {
         enemy.attackTarget(target);
      } else {
         // Move directly towards target (can phase through obstacles)
         enemy.moveTowardsWithForce(targetPosition, deltaTime);
      }
   }

   // public onDamaged(enemy: any, damage: number, source: any): void {
   //    // Ghosts become more aggressive when damaged
   //    if (source && source.position && source.targetType === TargetType.PLAYER) {
   //       const targetableSource: ITargetable = {
   //          id: source.id,
   //          position: source.position,
   //          targetType: TargetType.PLAYER,
   //          targetPriority: 15,
   //       };
   //
   //       enemy.setTarget(targetableSource);
   //    }
   // }

   public onTargetLost(enemy: any): void {
      enemy.setTarget(null);
   }
}

/**
 * AI Behavior Factory
 */
export class AIBehaviorFactory {
   private static behaviors = new Map<AIBehaviorType, () => IAIBehavior>([
      [AIBehaviorType.BASIC_CHASE, () => new BasicChaseAI()],
      [AIBehaviorType.STRATEGIC, () => new StrategicAI()],
      [AIBehaviorType.DEFENSIVE, () => new DefensiveAI()],
      [AIBehaviorType.SWARM, () => new SwarmAI()],
      [AIBehaviorType.GHOST_PHASE, () => new GhostPhaseAI()],
   ]);

   public static create(behaviorType: AIBehaviorType): IAIBehavior {
      const factory = this.behaviors.get(behaviorType);
      if (!factory) {
         throw new Error(`AI behavior not implemented: ${behaviorType}`);
      }
      return factory();
   }

   public static getAvailableBehaviors(): AIBehaviorType[] {
      return Array.from(this.behaviors.keys());
   }
}
