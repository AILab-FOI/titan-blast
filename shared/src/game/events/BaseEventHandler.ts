import { GameEventEmitter } from './GameEventEmitter';
import { BaseGame } from '../BaseGame';

export abstract class BaseEventHandler {
   protected game: BaseGame;
   protected eventEmitter: GameEventEmitter;

   constructor(game: BaseGame) {
      this.game = game;
      this.eventEmitter = GameEventEmitter.getInstance();
   }

   abstract initialize(): void;
   abstract cleanup(): void;
}
