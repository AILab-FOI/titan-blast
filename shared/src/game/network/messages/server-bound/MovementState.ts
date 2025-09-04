import { InputType } from '../../../Controls';

export interface MovementState {
   [InputType.UP]: boolean;
   [InputType.LEFT]: boolean;
   [InputType.RIGHT]: boolean;
   [InputType.DOWN]: boolean;
}

export interface MouseState {
   [InputType.SHOOT]: boolean;
}

export interface InputState extends MovementState, MouseState {}
