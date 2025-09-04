import { PlayerMoveRequest } from '../../../shared/src/game/network/messages/server-bound/PlayerMoveRequest';

export interface ServerPlayerMoveData extends PlayerMoveRequest {
   receivedAtTick: number;
}
