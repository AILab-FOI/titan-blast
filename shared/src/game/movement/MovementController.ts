import { PlayerMoveRequest } from '../network/messages/server-bound/PlayerMoveRequest';

export interface MovementController {
   move(playerMoveData: PlayerMoveRequest[]): void;

   getCurrentVelocity(): { x: number; y: number };
}
