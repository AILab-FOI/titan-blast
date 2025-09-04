import { Position } from '../../Position';
import { Vector } from '@dimforge/rapier2d-compat';

// The main shoot request containing all bullets fired
export interface ShootRequest {
   username: string;
   shootTick: number;
   shots: {
      gunId: string;
      origin: Position;
      angle: number;
   }[];
}

export interface RaycastHit {
   position: Position;
   normal: Vector;
   entityId?: string; // ID of the entity that was hit, if any
   distance: number;
}

export interface ShootResult {
   gunId: string;
   origin: Position;
   angle: number;
   bulletIndex: number;
   hits: RaycastHit[]; // Now an array of hits
}

export interface PelletResult {
   angle: number;
   hits: RaycastHit[]; // Hits for this specific pellet in order
}

export interface LocalShootResult extends ShootResult {
   pelletResults: PelletResult[]; // Contains all pellet data for visualization
}
