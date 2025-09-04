import { ControlConfig, defaultControls, InputType } from 'shared/game/Controls';
import { InputState, MovementState } from 'shared/game/network/messages/server-bound/MovementState';
import { Position } from 'shared/game/Position';

export class InputManager {
   private game: any;
   private pressedControls: { [key: string]: boolean };
   private controls: ControlConfig;
   private mouseX: number = 0;
   private mouseY: number = 0;
   private clickQueued = false;
   private lastMousePosition: Position = { x: 0, y: 0 };
   private static readonly MOUSE_MOVE_THRESHOLD: number = 5;

   constructor(game: any) {
      this.game = game;
      this.pressedControls = {};
      this.controls = { ...defaultControls };
      this.registerListeners();
   }

   private registerListeners() {
      window.addEventListener('keydown', (event) => this.handleKeyDown(event));
      window.addEventListener('keyup', (event) => this.handleKeyUp(event));
      window.addEventListener('mousedown', (event) => this.handleMouseDown(event));
      window.addEventListener('mouseup', (event) => this.handleMouseUp(event));
      window.addEventListener('wheel', (event) => this.handleWheel(event));
      window.addEventListener('mousemove', (event) => this.handleMouseMove(event));
   }

   private handleKeyDown(event: KeyboardEvent) {
      const control = this.getPressedControl(event);
      if (!control || this.pressedControls[control]) return;
      this.pressedControls[control] = true;
   }

   private handleKeyUp(event: KeyboardEvent) {
      const control = this.getPressedControl(event);
      if (!control) return;
      this.pressedControls[control] = false;
   }

   private handleMouseDown(event: MouseEvent) {
      const control = this.getPressedControl(event);
      if (!control || this.pressedControls[control]) return;
      this.pressedControls[control] = true;
      this.clickQueued = true;
   }

   private handleMouseUp(event: MouseEvent) {
      const control = this.getPressedControl(event);
      if (!control) return;
      this.pressedControls[control] = false;
   }

   private handleWheel(event: WheelEvent) {
      // this.events.emit('weaponChange', event.deltaY > 0 ? 'next' : 'previous');
   }

   private handleMouseMove(event: MouseEvent) {
      this.mouseX = event.clientX;
      this.mouseY = event.clientY;
   }

   private getPressedControl(event: KeyboardEvent | MouseEvent): InputType | false {
      for (const [control, keys] of Object.entries(this.controls)) {
         if (event instanceof KeyboardEvent && keys.includes(event.key)) {
            return control as InputType;
         }
         if (event instanceof MouseEvent && keys.includes(event.button.toString())) {
            return control as InputType;
         }
      }
      return false;
   }

   public isControlPressed(inputType: InputType): boolean {
      return this.pressedControls[inputType];
   }

   public getCurrentMovementState(): MovementState {
      return {
         [InputType.UP]: this.isControlPressed(InputType.UP),
         [InputType.DOWN]: this.isControlPressed(InputType.DOWN),
         [InputType.LEFT]: this.isControlPressed(InputType.LEFT),
         [InputType.RIGHT]: this.isControlPressed(InputType.RIGHT),
      };
   }

   public getCurrentInputState(): InputState {
      const movementState = this.getCurrentMovementState();

      return {
         ...movementState,
         [InputType.SHOOT]: this.isControlPressed(InputType.SHOOT),
      };
   }

   public isAnyMovementKeyPressed(movementState: MovementState): boolean {
      return (
         movementState[InputType.UP] ||
         movementState[InputType.DOWN] ||
         movementState[InputType.LEFT] ||
         movementState[InputType.RIGHT]
      );
   }

   // public configureControl(inputType: InputType, keys: string[]) {
   //    this.controls[inputType] = keys;
   // }

   public getMousePosition(): { x: number; y: number } {
      return { x: this.mouseX, y: this.mouseY };
   }

   public clearClickQueue() {
      this.clickQueued = false;
   }

   public isClickQueued() {
      return this.clickQueued;
   }

   public hasMouseMoved(): boolean {
      const dx = this.mouseX - this.lastMousePosition.x;
      const dy = this.mouseY - this.lastMousePosition.y;
      const moved = dx * dx + dy * dy > InputManager.MOUSE_MOVE_THRESHOLD * InputManager.MOUSE_MOVE_THRESHOLD;

      // Update the last mouse position only if moved
      if (moved) {
         this.lastMousePosition = { x: this.mouseX, y: this.mouseY };
      }

      return moved;
   }

   /**
    * Check if reload key was just pressed (one-time action)
    */
   public isReloadPressed(): boolean {
      return this.isControlPressed(InputType.RELOAD);
   }

   /**
    * Check if reload key was just pressed this frame (for single reload action)
    */
   public isReloadJustPressed(): boolean {
      // This would need frame-based tracking, but for now we can use the regular pressed state
      // since reload should be a one-time action per press
      return this.isControlPressed(InputType.RELOAD);
   }
}
