import { Position } from '../Position';
import { Vector } from '@dimforge/rapier2d-compat';
import { Entity } from '../Entity';

export interface ProjectileHit {
   position: Position;
   normal: Vector;
   distance: number;
   entity: Entity | null;
   colliderHandle: number;
   penetrationLeft: number;
   timeOfImpact: number;

   // Optional damage information (set by damage processing)
   damageDealt?: number;
}