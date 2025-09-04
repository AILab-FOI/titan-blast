import { MovementState } from './MovementState';

export interface PlayerMoveRequest {
   timestamp: number;
   clientGameTick: number;
   input: MovementState;
}
