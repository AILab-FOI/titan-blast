// shared/src/game/Interfaces.ts

import { Entity } from './Entity';

export enum EntityType {
   Player = 'player',
   Enemy = 'enemy',
   MapElement = 'mapElement',
   Bullet = 'bullet',
}

export interface ManagedEntity {
   getColliderHandle(): number;
}

export interface Damageable {
   health: number;
   maxHealth: number;

   takeDamage(amount: number): void;
}

export interface Breakable {
   durability: number;
   maxDurability: number;

   break(): void;
}

export interface Penetrable {
   getPenetrationResistance(): number;

   isPenetrable(): boolean;
}

/**
 * Interface for entities that can provide armor values for damage calculation
 * This provides a standardized way to get armor values from any entity
 */
export interface ArmorProvider {
   getArmor(): number;
}

export const isDamageable = (entity: Entity): entity is Entity & Damageable => {
   return 'takeDamage' in entity;
};

export const isBreakable = (entity: Entity): entity is Entity & Breakable => {
   return 'break' in entity;
};

export const isPenetrable = (entity: Entity): entity is Entity & Penetrable => {
   return 'isPenetrable' in entity;
};

export const isArmorProvider = (entity: Entity): entity is Entity & ArmorProvider => {
   return 'getArmor' in entity && typeof (entity as any).getArmor === 'function';
};
