import { Position } from 'shared/game/Position';

export interface Displayable {
   update(interpolationFactor: number): void;

   updateState(newPosition: Position, newRotation: number): void;
}
