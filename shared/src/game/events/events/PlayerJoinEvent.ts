import { Player } from '../../Player';
import { PlayerEvent } from './PlayerEvent';

export class PlayerJoinEvent extends PlayerEvent {
   protected readonly _isLocal: boolean;

   constructor(player: Player, isLocal: boolean = false) {
      super('player_join', player); // Pass specific event type
      this._isLocal = isLocal;
   }

   isLocal(): boolean {
      return this._isLocal;
   }

   // Type-safe method for getting the specific player type
   getPlayer(): Player {
      return this.player;
   }

   public static getType(): string {
      return 'player_join';
   }
}