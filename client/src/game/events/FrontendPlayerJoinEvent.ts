import { FrontendPlayer } from '../FrontendPlayer';
import { PlayerJoinEvent } from 'shared/game/events/events/PlayerJoinEvent';

export class FrontendPlayerJoinEvent extends PlayerJoinEvent {
   protected readonly player!: FrontendPlayer;
   protected readonly _isLocal: boolean;

   constructor(player: FrontendPlayer, isLocal: boolean) {
      super(player);
      this._isLocal = isLocal;
   }

   getPlayer(): FrontendPlayer {
      return this.player;
   }

   isLocal(): boolean {
      return this._isLocal;
   }
}
