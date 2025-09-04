import { Position } from '../../../Position';

export interface ServerShootEventData {
   username: string;
   tickShotAt: number;
   shots: {
      gunId: string;
      origin: Position;
      angle: number;
      hits: {
         position: Position;
         entityId?: string;
         distance: number;
      }[];
   }[];
}
