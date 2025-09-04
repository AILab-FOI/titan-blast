import { GameEvent } from './events/GameEvent';

export class GameEventEmitter {
   private handlers: Map<string, Set<(event: GameEvent) => void>> = new Map();
   private static instance: GameEventEmitter;

   public static getInstance(): GameEventEmitter {
      if (!GameEventEmitter.instance) {
         GameEventEmitter.instance = new GameEventEmitter();
      }
      return GameEventEmitter.instance;
   }

   public on<T extends GameEvent>(
      eventClass: { new (...args: any[]): T; getType(): string },
      handler: (event: T) => void,
   ): void {
      const type = eventClass.getType(); // Use static method instead
      if (!this.handlers.has(type)) {
         this.handlers.set(type, new Set());
      }
      this.handlers.get(type)!.add(handler as (event: GameEvent) => void);
   }

   public emit<T extends GameEvent>(event: T): void {
      const type = event.type;
      const handlers = this.handlers.get(type);
      if (handlers) {
         handlers.forEach((handler) => handler(event));
      }
   }

   public off<T extends GameEvent>(
      eventClass: { new (...args: any[]): T; getType(): string },
      handler: (event: T) => void,
   ): void {
      const type = eventClass.getType();
      const handlers = this.handlers.get(type);
      if (handlers) {
         handlers.delete(handler as (event: GameEvent) => void);
      }
   }
}
