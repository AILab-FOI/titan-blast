import { Position } from '../../Position';

export interface IPathfindingService {
   requestPath(enemyId: string, start: Position, target: Position, width: number, height: number): Position | null;

   hasLineOfSight(from: Position, to: Position): boolean;

   invalidateEnemyPath(enemyId: string): void;
}
