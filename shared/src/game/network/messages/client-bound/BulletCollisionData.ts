import { Position } from '../../../Position';

export interface BulletCollisionData {
   bulletId: string;
   position: Position;
   angle: number;
   otherEntityId: string;
}
