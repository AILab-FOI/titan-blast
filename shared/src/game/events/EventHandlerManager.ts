import { BaseEventHandler } from './BaseEventHandler';
import { BaseGame } from '../BaseGame';

export class EventHandlerManager {
   private handlers: BaseEventHandler[] = [];
   private game: BaseGame;

   constructor(game: BaseGame) {
      this.game = game;
   }

   initialize(): void {
      // Create and initialize all handlers
      // this.handlers = [new EntityEventHandler(this.game)];

      // Initialize all handlers
      this.handlers.forEach((handler) => handler.initialize());
   }

   cleanup(): void {
      // Cleanup all handlers
      this.handlers.forEach((handler) => handler.cleanup());
      this.handlers = [];
   }
}
