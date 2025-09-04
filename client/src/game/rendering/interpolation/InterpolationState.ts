import { Position } from 'shared/game/Position';

export interface InterpolationState {
   position: Position;
   rotation: number;
   timestamp: number;
}
