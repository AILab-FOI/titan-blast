import { PlayerData } from '../../../PlayerData';
import { Position } from '../../../Position';
import { PlayerType } from '../../../PlayerTypes';

export interface PlayerDataToSend {
   position: Position;
   playerType: PlayerType;
   playerData: PlayerData;
   gunSeed: string;
}

export interface PlayerJoinData {
   players: PlayerDataToSend[];
   seed: string;
   gameRunning: boolean;
}
