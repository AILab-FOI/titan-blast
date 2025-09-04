import { Position } from 'shared/game/Position';

export interface ClientPredictionState {
   timestamp: number;
   gameTick: number;
   position: Position;
}
