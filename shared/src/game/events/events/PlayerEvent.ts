import { Player } from '../../Player';
import { GameEvent } from './GameEvent';

export abstract class PlayerEvent extends GameEvent {
   protected readonly player: Player;

   constructor(eventType: string, player: Player) {
      super(eventType); // Pass the event type to GameEvent constructor
      this.player = player;
   }

   getPlayer(): Player {
      return this.player;
   }
}