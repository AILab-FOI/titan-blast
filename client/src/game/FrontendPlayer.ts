import { PlayerData } from 'shared/game/PlayerData';
import type * as RAPIER from '@dimforge/rapier2d-compat';
import { Container } from 'pixi.js';
import { Player } from 'shared/game/Player';
import { Position } from 'shared/game/Position';
import { PlayerMovementState } from '../../../shared/src/game/network/messages/client-bound/PlayerMovementState';
import { createPlayerTypeConfigs, PlayerTypeEnum } from 'shared/game/PlayerTypes';
import { FrontendGun } from './shooting/FrontendGun';
import FrontendGame from './FrontendGame';
import { ShootResult } from '../../../shared/src/game/network/messages/ShootingParams';
import { MathUtil } from 'shared/util/MathUtil';
import { ClientPredictionState } from './types/ClientPredictionState';
import { TimeBasedVault } from './types/TimeBasedVault';
import { gameSettings } from 'shared/game/SystemSettings';
import { Displayable } from './rendering/interpolation/Displayable';
import { GunType } from 'shared/game/shooting/GunTypes';
import { InputType } from 'shared/game/Controls';
import { ServerShootEventData } from 'shared/game/network/messages/client-bound/ServerShootEventData';
import {
   AnimatedPlayerRenderComponent,
   AnimatedRenderConfig,
} from './rendering/animation/AnimatedPlayerRenderComponent';

export class FrontendPlayer extends Player implements Displayable {
   renderComponent: AnimatedPlayerRenderComponent;
   gunContainer: Container;
   private predictionStatesVault: TimeBasedVault<ClientPredictionState> = new TimeBasedVault<ClientPredictionState>(
      120,
      gameSettings.gameUpdateIntervalMillis,
   );
   private pendingServerUpdates: PlayerMovementState[] = [];
   private readonly reconciliationThreshold = 30;

   constructor(
      world: RAPIER.World,
      RAPIER: typeof import('@dimforge/rapier2d-compat'),
      type: PlayerTypeEnum,
      playerData: PlayerData,
      public game: FrontendGame,
      gunSeed: string,
      parentContainer: Container,
      isLocal: boolean,
   ) {
      super(game, world, RAPIER, type, playerData, gunSeed);

      const characterTextures = this.game.getAssets().getCharacterTextures(type);
      if (!characterTextures) {
         throw new Error(`Character sprites not loaded for player type: ${type}`);
      }

      const renderConfig: AnimatedRenderConfig = {
         shape: this.type.physics.collider.shape,
         dimensions: this.type.physics.collider.dimensions,
         animationFrameRates: this.type.animationFrameRates,
      };

      const playerTypeConfig = createPlayerTypeConfigs(RAPIER)[type];

      this.renderComponent = new AnimatedPlayerRenderComponent(
         characterTextures,
         renderConfig,
         parentContainer,
         isLocal,
         true,
         playerData.username,
         playerTypeConfig,
      );

      this.gunContainer = this.renderComponent.gunContainer;
      // this.renderComponent.container.addChild(this.gunContainer);

      if (!isLocal) {
         this.renderComponent.container.zIndex = 10;
      }

      this.type.guns.forEach((gunConfig) => {
         this.setGun(gunConfig.type, gunConfig.positionOffset);
      });
   }

   public shoot(currentTick: number): ShootResult[] {
      const mousePressed = this.game.getInputManager().isControlPressed(InputType.SHOOT);
      const clickQueued = this.game.getInputManager().isClickQueued();

      if (!this._gun) return [];

      const result = (this._gun as FrontendGun).tryShoot(currentTick, mousePressed, clickQueued);
      return result ? [result] : [];
   }

   public visualizeRemoteShot(shootData: ServerShootEventData): void {
      if (!this._gun) return;

      // Since we only have one gun, take the first shot
      if (shootData.shots.length === 0) return;

      const shotData = shootData.shots[0];

      if (this._gun.id !== shotData.gunId) {
         console.warn(`Gun ID mismatch in visualizeRemoteShot: expected ${this._gun.id}, got ${shotData.gunId}`);
         return;
      }

      (this._gun as FrontendGun).visualizeRemoteShot({
         origin: shotData.origin,
         angle: shotData.angle,
         hits: shotData.hits,
         tickShotAt: shootData.tickShotAt,
      });
   }

   setGun(gunType: GunType, positionOffset: Position): void {
      const gun = new FrontendGun(this.world, this.rapier, this, gunType, positionOffset, this.game, this.gunContainer);
      this._gun = gun;
   }

   public aim(worldAimPosition: Position): void {
      if (!this._gun) return;

      // Calculate angle between player and world aim position
      const deltaX = worldAimPosition.x - this.position.x;
      const deltaY = worldAimPosition.y - this.position.y;
      const containerRotation = Math.atan2(deltaY, deltaX);

      // Set gun container rotation
      this.renderComponent.rotateGuns(containerRotation);

      // Update gun rotation
      (this._gun as FrontendGun).aimAt(worldAimPosition);
   }

   public setRemoteAimPosition(worldAimPosition: Position): void {
      if (!this._gun) return;

      // Calculate angle between player and world aim position
      const deltaX = worldAimPosition.x - this.position.x;
      const deltaY = worldAimPosition.y - this.position.y;
      const containerRotation = Math.atan2(deltaY, deltaX);

      // Set gun container rotation
      this.renderComponent.rotateGuns(containerRotation);

      // Set target aim angle for interpolation
      const gunWorldAngle = Math.atan2(deltaY, deltaX);
      (this._gun as FrontendGun).setTargetAimAngle(gunWorldAngle);
   }

   update(): void {
      this.renderComponent.update();

      // Update the gun (important for interpolation and reload state)
      if (this._gun) {
         (this._gun as FrontendGun).update();
      }
   }

   get gunContainerRotation() {
      return this.gunContainer.rotation;
   }

   handleServerUpdate(update: PlayerMovementState) {
      this.pendingServerUpdates.push(update);
   }

   public processServerUpdates(serverState: PlayerMovementState) {
      this.pendingServerUpdates = [];

      // If this is a remote player, simply update their state
      if (!this.game.getPlayerManager().isLocalPlayer(this)) {
         // console.log(
         //    'setting state for remote player',
         //    serverState.position.x,
         //    serverState.position.y,
         // );
         console.log('updating state for remote player');
         this.updateState(serverState.position, 0);
         // this.setVelocity(serverState.velocity);

         // Update movement animation for remote players based on server velocity
         this.renderComponent.updateMovement(serverState.velocity);
         return;
      }

      // Local player reconciliation logic
      const latency = Math.max(0, serverState.receivedAtClient! - serverState.timestamp);

      const clientStateAtServerTime = this.predictionStatesVault.get(serverState.predictionTimestamp);
      if (!clientStateAtServerTime) {
         console.log('client state at server time not found');
         return;
      }

      // console.log(``);
      const distance = MathUtil.distance(serverState.position, clientStateAtServerTime.position);
      console.log(
         'dist:',
         distance,
         'cpTick:',
         serverState.predictionTick,
         'cTick:',
         this.game.getPhysicsManager().getGameTick(),
         'sTick:',
         serverState.gameTick,
         'cStateTick:',
         clientStateAtServerTime.gameTick,
         'p->s tmpDiff',
         Math.abs(serverState.predictionTimestamp - serverState.timestamp).toFixed(0),
         's->c tmpDiff',
         Math.abs(this.game.getPhysicsManager().getCurrentTickTime() - serverState.timestamp).toFixed(0),
         'p->c tmpDiff',
         Math.abs(this.game.getPhysicsManager().getCurrentTickTime() - serverState.predictionTimestamp).toFixed(0),
         'pStamp',
         serverState.predictionTimestamp,
         'latency',
         latency,
      );
      // console.log('🫥 DISTANCE:', distance);

      this.predictionStatesVault.removeOlderThan(serverState.predictionTimestamp);

      const needsReconciliation = distance > this.reconciliationThreshold;
      if (!needsReconciliation) return;
      console.log('--------------------- reconciliating ------------------------');

      // Perform reconciliation for local player
      this.setPosition(serverState.position);
      this.setRotation(0);
      this.setVelocity(serverState.velocity);
      this.setAngularVelocity(0);
      this.renderComponent.updateState(serverState.position, 0);
      // console.log('rotation:', this.rotationDegrees, this.rotationRadians);
   }

   public trackMovement() {
      // Store current player position on the client. These positions will be then compared when server position arrives
      const currentPredictionState: ClientPredictionState = {
         timestamp: this.game.getPhysicsManager().getCurrentTickTime(),
         position: {
            x: this.position.x,
            y: this.position.y,
         },
         gameTick: this.game.getPhysicsManager().getGameTick(),
      };

      this.predictionStatesVault.add(currentPredictionState);

      this.renderComponent.updateState(this.position, 0);

      const movementVelocity = this.movementController.getCurrentVelocity();
      this.renderComponent.updateMovement(movementVelocity);
   }

   updateState(newPosition: Position, newRotation: number) {
      this.setPosition(newPosition);
      this.setRotation(newRotation);
      this.renderComponent.updateState(newPosition, newRotation);
   }

   spawn(position: Position, rotation: number) {
      super.spawn(position, rotation);
      this.renderComponent.updateState(position, this.body.rotation());
   }

   /**
    * Play death animation for this player
    */
   public playDeathAnimation(): void {
      this.renderComponent.playDeathAnimation();
   }

   /**
    * Check if death animation is complete
    */
   public isDeathAnimationComplete(): boolean {
      return this.renderComponent.isDeathAnimationComplete();
   }
}
