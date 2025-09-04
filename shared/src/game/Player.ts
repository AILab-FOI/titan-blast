import { MovableEntity } from './MovableEntity';
import type * as RAPIER from '@dimforge/rapier2d-compat';
import { RigidBody } from '@dimforge/rapier2d-compat';
import { PlayerData } from './PlayerData';
import { createPlayerPhysics, createPlayerTypeConfigs, PlayerType, PlayerTypeEnum } from './PlayerTypes';
import { MovementController } from './movement/MovementController';
import { Gun } from './shooting/Gun';
import { GunType } from './shooting/GunTypes';
import { Position } from './Position';
import { PlayerMoveRequest } from './network/messages/server-bound/PlayerMoveRequest';
import { BaseGame } from './BaseGame';
import { pixelToPhysics } from '../util/Utils';

export abstract class Player extends MovableEntity {
   public game: BaseGame;
   lastProcessedTick: number;
   private readonly _playerData: PlayerData;
   private readonly _type: PlayerType;
   private readonly _movementController: MovementController;

   private _maxHealth: number;
   private _health: number;
   private _viewDistance: number;

   protected _gunSeed: string;

   protected _gun: Gun | null = null;

   currentChunkX: number;
   currentChunkY: number;

   constructor(
      game: BaseGame,
      world: RAPIER.World,
      RAPIER: typeof import('@dimforge/rapier2d-compat'),
      type: PlayerTypeEnum,
      playerData: PlayerData,
      gunSeed: string,
   ) {
      const playerType = createPlayerTypeConfigs(RAPIER)[type];

      super(world, RAPIER, playerData.id);
      this.game = game;
      this._type = playerType;
      this._playerData = playerData;
      this._movementController = new this._type.movementController(this);

      this.lastProcessedTick = 0;

      this._health = this._maxHealth = this._type.maxHealth;
      this._viewDistance = this._type.viewDistance;
      this._gunSeed = gunSeed;

      this.currentChunkX = -1;
      this.currentChunkY = -1;
   }

   public move(playerMoveData: PlayerMoveRequest[]) {
      this.movementController.move(playerMoveData);
   }

   updateChunkPosition(newChunkX: number, newChunkY: number) {
      this.currentChunkX = newChunkX;
      this.currentChunkY = newChunkY;
   }

   hasChangedChunk(newChunkX: number, newChunkY: number): boolean {
      return this.currentChunkX !== newChunkX || this.currentChunkY !== newChunkY;
   }

   get playerData(): PlayerData {
      return this._playerData;
   }

   get type(): PlayerType {
      return this._type;
   }

   get username(): string {
      return this._playerData.username;
   }

   get name(): string {
      return this._playerData.username;
   }

   get health(): number {
      return this._health;
   }

   get maxHealth(): number {
      return this._maxHealth;
   }

   get movementSpeed(): number {
      return this._type.movementSpeed;
   }

   get viewDistance(): number {
      return this._viewDistance;
   }

   get movementController(): MovementController {
      return this._movementController;
   }

   get gunSeed(): string {
      return this._gunSeed;
   }

   public getGun(): Gun | null {
      return this._gun;
   }

   public abstract setGun(gunType: GunType, positionOffset: Position): void;

   protected createBody(position: Position, rotation: number): RigidBody {
      const { rigidBodyDesc, colliderDesc } = createPlayerPhysics(this.rapier, this.type.physics);

      // Set the position and rotation on the rigid body descriptor
      rigidBodyDesc.setTranslation(pixelToPhysics(position.x), pixelToPhysics(position.y));
      rigidBodyDesc.setRotation(rotation);

      // Create the rigid body
      const body = this.world.createRigidBody(rigidBodyDesc);

      // Create the collider
      this.world.createCollider(colliderDesc, body);

      return body;
   }

   /**
    * Manual reload all guns that can be reloaded
    */
   public manualReload(currentTick: number): boolean {
      if (!this._gun || !this._gun.canManualReload()) {
         return false;
      }

      return this._gun.startReload(currentTick);
   }
}
