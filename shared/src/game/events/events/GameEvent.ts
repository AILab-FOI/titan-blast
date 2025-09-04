// shared/src/game/events/GameEvent.ts

import { TimeUtil } from '../../../util/TimeUtil';

export abstract class GameEvent {
   public readonly type: string;
   public readonly timestamp: number;

   constructor(type: string) {
      this.type = type;
      this.timestamp = TimeUtil.getCurrentTimestamp();
   }

   public static getType(): string {
      throw new Error('getType() must be implemented by subclasses');
   }
}