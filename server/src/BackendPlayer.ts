import type * as RAPIER from '@dimforge/rapier2d-compat';
import { Player } from 'shared/game/Player';
import { PlayerData } from 'shared/game/PlayerData';
import { PlayerTypeEnum } from 'shared/game/PlayerTypes';
import { ShootRequest, ShootResult } from '../../shared/src/game/network/messages/ShootingParams';
import { BackendGun } from './BackendGun';
import { GunType } from 'shared/game/shooting/GunTypes';
import { Position } from 'shared/game/Position';
import { BaseGame } from 'shared/game/BaseGame';

export class BackendPlayer extends Player {
   constructor(
      game: BaseGame,
      world: RAPIER.World,
      RAPIER: typeof import('@dimforge/rapier2d-compat'),
      type: PlayerTypeEnum,
      playerData: PlayerData,
      gunSeed: string,
   ) {
      super(game, world, RAPIER, type, playerData, gunSeed);

      this.type.guns.forEach((gunConfig) => {
         this.setGun(gunConfig.type, gunConfig.positionOffset);
      });
   }

   setGun(gunType: GunType, positionOffset: Position): void {
      const gun = new BackendGun(this.game, this.world, this.rapier, this, gunType, positionOffset);
      this._gun = gun;
   }

   public validateAndShoot(shootRequest: ShootRequest): ShootResult[] {
      if (!this._gun) {
         console.warn(`Player ${this.username} has no gun to shoot with`);
         return [];
      }

      // Since we only have one gun, take the first shot request
      if (shootRequest.shots.length === 0) {
         return [];
      }

      const shot = shootRequest.shots[0];

      // Validate gun ID matches
      if (shot.gunId !== this._gun.id) {
         console.warn(`Gun ID mismatch: expected ${this._gun.id}, got ${shot.gunId}`);
         return [];
      }

      const result = (this._gun as BackendGun).validateAndShoot(shootRequest.shootTick, shot.origin, shot.angle);
      return result ? [result] : [];
   }
}
