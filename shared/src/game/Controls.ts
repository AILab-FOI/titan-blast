export enum InputType {
   UP = 'UP',
   RIGHT = 'RIGHT',
   DOWN = 'DOWN',
   LEFT = 'LEFT',
   SHOOT = 'SHOOT',
   RELOAD = 'reload',
   THROW_GRENADE = 'THROW_GRENADE',
   TOGGLE_PAUSE = 'TOGGLE_PAUSE',
}

export interface ControlConfig {
   [InputType.UP]: string[];
   [InputType.RIGHT]: string[];
   [InputType.DOWN]: string[];
   [InputType.LEFT]: string[];
   [InputType.SHOOT]: string[];
   [InputType.RELOAD]: string;
   [InputType.THROW_GRENADE]: string[];
   [InputType.TOGGLE_PAUSE]: string[];
}

export const defaultControls: ControlConfig = {
   [InputType.UP]: ['w', 'ArrowUp'],
   [InputType.RIGHT]: ['d', 'ArrowRight'],
   [InputType.DOWN]: ['s', 'ArrowDown'],
   [InputType.LEFT]: ['a', 'ArrowLeft'],
   [InputType.SHOOT]: ['0'],
   [InputType.RELOAD]: 'KeyR',
   [InputType.THROW_GRENADE]: ['g'],
   [InputType.TOGGLE_PAUSE]: ['Escape'],
};
