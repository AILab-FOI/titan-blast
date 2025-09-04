import { Container, Texture } from 'pixi.js';
import FrontendGame from '../FrontendGame';
import { Gun } from 'shared/game/shooting/Gun';
import { GUN_CONFIGS, GunType } from 'shared/game/shooting/GunTypes';
import * as RAPIER from '@dimforge/rapier2d-compat';
import { FrontendPlayer } from '../FrontendPlayer';
import { Position } from 'shared/game/Position';
import { RenderComponent, RenderConfig } from '../rendering/RenderComponent';
import { EntityShape } from 'shared/game/PlayerTypes';
import { Player } from 'shared/game/Player';
import { BasicRenderComponent } from '../rendering/BasicRenderComponent';
import {
   LocalShootResult,
   PelletResult,
   ShootResult,
} from '../../../../shared/src/game/network/messages/ShootingParams';
import { BulletAnimator } from '../rendering/BulletAnimator';
import { BulletTrail } from '../rendering/trails/BulletTrail';
import { MathUtil } from 'shared/util/MathUtil';
import { gameSettings } from 'shared/game/SystemSettings';
import { TaskPriority } from 'shared/util/TaskScheduler';
import { GunStateSync, ReloadEvent } from '../../../../shared/src/game/network/messages/ReloadMessages';

export class FrontendGun extends Gun {
   private bulletTexture: Texture;
   private gunTexture: Texture;
   renderComponent: RenderComponent;

   // Aiming state
   private currentAimAngle: number = 0;
   private isFlipped: boolean = false;
   private targetAimAngle: number = 0;

   private interpolationSpeed: number = 0.3;

   private originalWidth: number;
   private originalHeight: number;

   constructor(
      world: RAPIER.World,
      rapier: typeof RAPIER,
      player: Player,
      gunType: GunType,
      positionOffset: Position,
      public game: FrontendGame,
      parentContainer: Container,
   ) {
      super(game, world, rapier, player, gunType, positionOffset);

      const gunConfig = GUN_CONFIGS[gunType];

      this.originalWidth = gunConfig.width;
      this.originalHeight = gunConfig.height;

      this.gunTexture = this.getGunTexture(gunConfig.gunTextureName);
      this.bulletTexture = this.game.getAssets().getBulletSprites().textures[gunConfig.bulletTextureName];

      if (!this.bulletTexture) {
         console.warn(`Bullet texture ${gunConfig.bulletTextureName} not found, using white texture`);
         this.bulletTexture = Texture.WHITE;
      }

      const renderConfig: RenderConfig = {
         shape: EntityShape.Cuboid,
         dimensions: { width: this.originalWidth, height: this.originalHeight },
      };

      this.renderComponent = new BasicRenderComponent(this.gunTexture, renderConfig, parentContainer);

      // Set up gun sprite properties
      this.setupGunSprite();

      // Position the gun based on the offset
      this.updateGunPosition();
   }

   /**
    * Get gun texture with fallback logic
    */
   private getGunTexture(textureName: string): Texture {
      let texture = this.game.getAssets().getGunSprites().textures[textureName];

      if (!texture) {
         texture = this.game.getAssets().getBulletSprites().textures[textureName];
      }

      if (!texture) {
         texture = this.game.getAssets().getMapSprites().textures[textureName];
      }

      if (!texture) {
         console.warn(`Gun texture ${textureName} not found in any sprite sheet, using white texture`);
         texture = Texture.WHITE;
      }

      return texture;
   }

   /**
    * Set up the gun sprite anchor and initial properties
    */
   private setupGunSprite(): void {
      this.renderComponent.sprite.anchor.set(0, 0.5);

      // Set gun dimensions using the original dimensions, not this.width/height
      // This prevents scaling issues when the sprite is flipped
      this.renderComponent.sprite.width = this.originalWidth;
      this.renderComponent.sprite.height = this.originalHeight;

      // Initialize scale properly to avoid thin gun issues
      this.renderComponent.sprite.scale.set(1, 1);

      // Make sure the gun is visible
      this.renderComponent.container.visible = true;
      this.renderComponent.sprite.visible = true;

      console.log(`Gun ${this.gunType} initialized: width=${this.originalWidth}, height=${this.originalHeight}`);
   }

   /**
    * Update gun position relative to player based on current state
    */
   private updateGunPosition(): void {
      // Position gun at the configured offset
      this.renderComponent.container.position.set(this.positionOffset.x, this.positionOffset.y);
   }

   private updateGunRotation(): void {
      // Get the gun container rotation (relative to player)
      const containerRotation = this.getGunContainerRotation();

      // Calculate the total aim angle in world space
      const totalAimAngle = containerRotation + this.currentAimAngle;


      const normalizedAngle = Math.atan2(Math.sin(totalAimAngle), Math.cos(totalAimAngle));
      const shouldFlip = Math.abs(normalizedAngle) > Math.PI / 2;

      if (shouldFlip !== this.isFlipped) {
         this.isFlipped = shouldFlip;

         if (this.isFlipped) {
            this.renderComponent.sprite.scale.set(1, -1);
            this.renderComponent.container.rotation = this.currentAimAngle;
         } else {
            this.renderComponent.sprite.scale.set(1, 1);
            this.renderComponent.container.rotation = this.currentAimAngle;
         }

         this.renderComponent.sprite.width = this.originalWidth;
         this.renderComponent.sprite.height = this.originalHeight;
      } else {
         this.renderComponent.container.rotation = this.currentAimAngle;
      }
   }

   /**
    * Aim the gun at a world position (for local player)
    */
   public aimAt(worldAimPosition: Position): void {
      const playerPosition = this.player.position;

      // Calculate angle from player center to target
      const deltaX = worldAimPosition.x - playerPosition.x;
      const deltaY = worldAimPosition.y - playerPosition.y;
      const angleToTarget = Math.atan2(deltaY, deltaX);

      // Convert world angle to local angle relative to gun container
      const containerRotation = this.getGunContainerRotation();
      this.currentAimAngle = angleToTarget - containerRotation;
      this.targetAimAngle = this.currentAimAngle;

      // Update the gun's visual rotation
      this.updateGunRotation();
   }

   public setTargetAimAngle(worldAimAngle: number): void {
      const containerRotation = this.getGunContainerRotation();
      const newTargetAngle = worldAimAngle - containerRotation;


      const angleDiff = MathUtil.shortestAngleBetween(this.currentAimAngle, newTargetAngle);
      const SNAP_THRESHOLD = 0.05; // ~3 degrees - snap if very close

      // console.log(
      //    `[${this.id}] Angle difference: ${((angleDiff * 180) / Math.PI).toFixed(1)}°, threshold: ${((SNAP_THRESHOLD * 180) / Math.PI).toFixed(1)}°`,
      // );

      if (Math.abs(angleDiff) < SNAP_THRESHOLD) {
         this.currentAimAngle = newTargetAngle;
         this.targetAimAngle = newTargetAngle;
         this.updateGunRotation();
      } else {
         // Set target for interpolation
         // console.log(`[${this.id}] Setting target for interpolation`);
         this.targetAimAngle = newTargetAngle;
      }
   }

   public update(): void {
      const isRemotePlayer = !this.game.getPlayerManager().isLocalPlayer(this.player as FrontendPlayer);

      if (isRemotePlayer) {
         // Calculate shortest path between current and target angles
         const angleDiff = MathUtil.shortestAngleBetween(this.currentAimAngle, this.targetAimAngle);

         if (Math.abs(angleDiff) > 0.005) {
            const adaptiveSpeed = Math.min(0.5, this.interpolationSpeed + Math.abs(angleDiff) * 0.3);
            const oldAngle = this.currentAimAngle;
            this.currentAimAngle += angleDiff * adaptiveSpeed;

            // DEBUG: Log when interpolation happens
            if (Math.abs(oldAngle - this.currentAimAngle) > 0.01) {
               // console.log(
               //    `[${this.id}] Interpolating: ${((oldAngle * 180) / Math.PI).toFixed(1)}° -> ${((this.currentAimAngle * 180) / Math.PI).toFixed(1)}° (speed: ${adaptiveSpeed.toFixed(2)})`,
               // );
            }

            this.updateGunRotation();
         } else if (Math.abs(angleDiff) > 0.001) {
            // Snap to target when very close to avoid jitter
            // console.log(
            //    `[${this.id}] Snapping to target: ${((this.currentAimAngle * 180) / Math.PI).toFixed(1)}° -> ${((this.targetAimAngle * 180) / Math.PI).toFixed(1)}°`,
            // );
            this.currentAimAngle = this.targetAimAngle;
            this.updateGunRotation();
         }
      }

      this.updateGunPosition();

      if (
         this.renderComponent.sprite.width !== this.originalWidth ||
         Math.abs(this.renderComponent.sprite.height) !== this.originalHeight
      ) {
         this.renderComponent.sprite.width = this.originalWidth;
         this.renderComponent.sprite.height = this.originalHeight;
      }
   }

   public shouldTrigger(isMousePressed: boolean, isClickQueued: boolean): boolean {
      if (this.isAutomatic()) {
         return isMousePressed || isClickQueued;
      }
      return isClickQueued;
   }

   public tryShoot(currentTick: number, isMousePressed: boolean, isClickQueued: boolean): ShootResult | null {
      if (!this.shouldTrigger(isMousePressed, isClickQueued)) {
         return null;
      }

      const origin = this.calculateGunPosition();
      const baseRotation = this.getGunContainerRotation() + this.currentAimAngle;

      return this.shoot(currentTick, origin, baseRotation);
   }

   protected calculateGunPosition(): Position {
      const containerRotation = this.getGunContainerRotation();

      const gunLength = this.originalWidth;
      const offsetX = this.positionOffset.x + gunLength;
      const offsetY = this.positionOffset.y;

      const rotatedOffsetX = offsetX * Math.cos(containerRotation) - offsetY * Math.sin(containerRotation);
      const rotatedOffsetY = offsetX * Math.sin(containerRotation) + offsetY * Math.cos(containerRotation);

      return {
         x: this.player.position.x + rotatedOffsetX,
         y: this.player.position.y + rotatedOffsetY,
      };
   }

   protected getGunContainerRotation(): number {
      return (this.player as FrontendPlayer).renderComponent.getGunsRotation();
   }

   protected getFullGunRotation(): number {
      return this.getGunContainerRotation() + this.currentAimAngle;
   }

   protected onShoot(result: LocalShootResult): void {
      result.pelletResults.forEach((pelletResult, pelletIndex) => {
         const startPos = result.origin;
         let endPos: Position;

         if (pelletResult.hits.length > 0) {
            let remainingPenetration = this.penetration;
            let shouldContinue = true;
            let stoppedAtHitIndex = -1;

            for (let i = 0; i < pelletResult.hits.length; i++) {
               const hit = pelletResult.hits[i];

               const entity = hit.entityId ? this.game.getEntityManager().getEntityById(hit.entityId) : null;

               if (entity === null) {
                  // Hit a wall (map element) - bullet stops immediately
                  shouldContinue = false;
                  stoppedAtHitIndex = i;
                  break;
               } else {
                  // Hit an entity - get its armor
                  const entityArmor = this.getBasicEntityArmor(entity);

                  // Check if bullet can pass through BEFORE reducing penetration
                  // Need double penetration to pass through
                  const canPassThrough = remainingPenetration >= entityArmor * 2;

                  // Reduce penetration by armor value
                  remainingPenetration = Math.max(0, remainingPenetration - entityArmor);

                  // Stop if bullet can't pass through this entity (needs double penetration)
                  if (!canPassThrough) {
                     shouldContinue = false;
                     stoppedAtHitIndex = i;
                     break;
                  }

                  // Also stop if no penetration left at all
                  if (remainingPenetration <= 0) {
                     shouldContinue = false;
                     stoppedAtHitIndex = i;
                     break;
                  }
               }
            }

            if (shouldContinue && remainingPenetration > 0) {
               // Bullet still has penetration - continue to max range
               const maxTravelDistance = this.gunConfig.damageRanges.maxRange;
               endPos = {
                  x: startPos.x + Math.cos(pelletResult.angle) * maxTravelDistance,
                  y: startPos.y + Math.sin(pelletResult.angle) * maxTravelDistance,
               };

               // Only adjust to screen edge if it's closer than max range
               if (!this.game.getRenderManager().getCamera().isPositionOnScreen(endPos)) {
                  const screenEdgePos = this.game
                     .getRenderManager()
                     .getCamera()
                     .getScreenEdgePoint(startPos, pelletResult.angle);
                  const screenEdgeDistance = Math.sqrt(
                     Math.pow(screenEdgePos.x - startPos.x, 2) + Math.pow(screenEdgePos.y - startPos.y, 2),
                  );

                  // Use whichever is closer: max range or screen edge
                  if (screenEdgeDistance < maxTravelDistance) {
                     endPos = screenEdgePos;
                  }
               }
            } else {
               // Bullet stopped - use the position of the hit that actually stopped it
               const hitThatStoppedBullet = pelletResult.hits[stoppedAtHitIndex];
               endPos = hitThatStoppedBullet.position;
            }
         } else {
            // No hits - bullet travels to max range
            const maxTravelDistance = this.gunConfig.damageRanges.maxRange;
            endPos = {
               x: startPos.x + Math.cos(pelletResult.angle) * maxTravelDistance,
               y: startPos.y + Math.sin(pelletResult.angle) * maxTravelDistance,
            };

            // Only adjust to screen edge if it's closer than max range
            if (!this.game.getRenderManager().getCamera().isPositionOnScreen(endPos)) {
               const screenEdgePos = this.game
                  .getRenderManager()
                  .getCamera()
                  .getScreenEdgePoint(startPos, pelletResult.angle);
               const screenEdgeDistance = Math.sqrt(
                  Math.pow(screenEdgePos.x - startPos.x, 2) + Math.pow(screenEdgePos.y - startPos.y, 2),
               );

               // Use whichever is closer: max range or screen edge
               if (screenEdgeDistance < maxTravelDistance) {
                  endPos = screenEdgePos;
               }
            }
         }

         // Create bullet animator with the new visual config
         const bulletAnimator = new BulletAnimator(
            this.game,
            this.bulletTexture,
            this.game.getRenderManager().mapContainer,
            startPos,
            endPos,
            pelletResult.angle,
            this.calculateBulletDuration(startPos, endPos),
            this.gunConfig.bulletVisual.animationCurve,
            this.gunConfig.bulletWidth,
            this.gunConfig.bulletHeight,
         );

         this.game.getRenderManager().addRenderableObject(bulletAnimator);

         const bulletTrail = new BulletTrail(
            this.game.getRenderManager().mapContainer,
            this.game,
            bulletAnimator.getSprite(),
            {
               historySize: 20,
               ropeSize: 25,
               texture: Texture.WHITE,
               fadeSpeed: 0.02,
               maxOpacity: 0.6,
               lightnessAdjust: 0.4,
               width: Math.max(2, (this.gunConfig.bulletWidth / 2) * gameSettings.physics.lengthUnit),
            },
            startPos,
            endPos,
         );

         this.game.getRenderManager().addRenderableObject(bulletTrail);
      });
   }

   public visualizeRemoteShot(data: {
      origin: Position;
      angle: number;
      hits: { position: Position; entityId?: string; distance: number }[];
      tickShotAt: number;
   }): void {
      const pelletCount = this.gunConfig.pelletCount || 1;
      const pelletAngles = this.calculatePelletAngles(data.angle, data.tickShotAt, 0, pelletCount);

      const pelletResults: PelletResult[] = pelletAngles.map((angle) => ({
         angle,
         hits: [],
      }));

      if (pelletCount === 1) {
         pelletResults[0].hits = data.hits.map((hit) => ({
            position: hit.position,
            normal: { x: 0, y: 0 },
            distance: hit.distance,
            entity: hit.entityId ? this.game.getEntityManager().getEntityById(hit.entityId) : null,
            colliderHandle: 0,
            penetrationLeft: 0,
         }));
      } else {
         data.hits.forEach((hit) => {
            const hitAngle = Math.atan2(hit.position.y - data.origin.y, hit.position.x - data.origin.x);
            let closestPelletIndex = 0;
            let closestAngleDiff = Math.abs(MathUtil.shortestAngleBetween(pelletAngles[0], hitAngle));

            for (let i = 1; i < pelletAngles.length; i++) {
               const angleDiff = Math.abs(MathUtil.shortestAngleBetween(pelletAngles[i], hitAngle));
               if (angleDiff < closestAngleDiff) {
                  closestAngleDiff = angleDiff;
                  closestPelletIndex = i;
               }
            }

            pelletResults[closestPelletIndex].hits.push({
               position: hit.position,
               normal: { x: 0, y: 0 },
               distance: hit.distance,
               entityId: hit.entityId,
            });
         });
      }

      const localResult: LocalShootResult = {
         gunId: this.id,
         origin: data.origin,
         angle: data.angle,
         bulletIndex: 0,
         hits: data.hits.map((hit) => ({
            position: hit.position,
            normal: { x: 0, y: 0 },
            distance: hit.distance,
            entity: hit.entityId ? this.game.getEntityManager().getEntityById(hit.entityId) : null,
            colliderHandle: 0,
            penetrationLeft: 0,
         })),
         pelletResults,
      };

      this.onShoot(localResult);
   }

   private calculateBulletDuration(startPos: Position, endPos: Position): number {
      const distance = Math.sqrt(Math.pow(endPos.x - startPos.x, 2) + Math.pow(endPos.y - startPos.y, 2));

      const maxRange = this.gunConfig.damageRanges.maxRange;
      const baseDuration = this.gunConfig.bulletVisual.duration;

      // Scale duration based on distance traveled vs max range
      const distanceRatio = Math.min(distance / maxRange, 1);

      // Minimum duration is 25% of base duration (prevents too-fast bullets)
      const minDurationRatio = 0.25;
      const scaledDuration = baseDuration * (minDurationRatio + (1 - minDurationRatio) * distanceRatio);

      return Math.max(scaledDuration, 16); // At least 16ms (1 frame at 60fps)
   }

   /**
    * Override - client doesn't broadcast events, server does
    */
   protected onReloadStarted(tick: number): void {
      console.log(`Gun ${this.id} started reloading at tick ${tick}`);
      // Could trigger UI effects here (reload indicator, sound, etc.)
   }

   /**
    * Override - client doesn't broadcast events, server does
    */
   protected onReloadCompleted(tick: number): void {
      console.log(`Gun ${this.id} completed reloading at tick ${tick}`);
      // Could trigger UI effects here (reload complete sound, etc.)
   }

   /**
    * Handle reload event from server
    */
   public handleServerReloadEvent(event: ReloadEvent): void {
      const currentTick = this.game.getPhysicsManager().getGameTick();

      if (event.eventType === 'started') {
         // Server says reload started - sync our state
         if (!this.reloading) {
            console.log(`Syncing reload start for gun ${this.id} at tick ${event.tick}`);
            this.reloading = true;
            this.reloadStartTick = event.tick;

            // Schedule completion based on server timing
            this.reloadTaskId = this.game
               .getPhysicsManager()
               .scheduleTask(
                  () => this.completeReload(event.tick + this.reloadDurationTicks),
                  TaskPriority.HIGH,
                  this.reloadDurationTicks - (currentTick - event.tick),
               );
         }
      } else if (event.eventType === 'completed') {
         // Server says reload completed - sync our state
         console.log(`Syncing reload completion for gun ${this.id} at tick ${event.tick}`);
         if (this.reloadTaskId) {
            this.game.getPhysicsManager().cancelTask(this.reloadTaskId);
         }
         this.currentAmmo = event.newAmmoCount || this.magazineSize;
         this.reloading = false;
         this.reloadStartTick = 0;
         this.reloadTaskId = null;
      }
   }

   /**
    * Sync gun state from server (for edge case corrections)
    */
   public syncFromServer(syncData: GunStateSync): void {
      const currentTick = this.game.getPhysicsManager().getGameTick();

      // Sync ammo count
      this.currentAmmo = syncData.currentAmmo;

      // Sync reload state
      if (syncData.isReloading && !this.reloading) {
         // Server says we should be reloading, but we're not
         console.log(`Correcting reload state for gun ${this.id} - starting reload`);
         if (syncData.reloadStartTick && syncData.reloadDurationTicks) {
            this.reloading = true;
            this.reloadStartTick = syncData.reloadStartTick;

            const remainingTicks = syncData.reloadDurationTicks - (currentTick - syncData.reloadStartTick);
            if (remainingTicks > 0) {
               this.reloadTaskId = this.game
                  .getPhysicsManager()
                  .scheduleTask(
                     () => this.completeReload(currentTick + remainingTicks),
                     TaskPriority.HIGH,
                     remainingTicks,
                  );
            } else {
               // Reload should have completed already
               this.completeReload(currentTick);
            }
         }
      } else if (!syncData.isReloading && this.reloading) {
         // Server says we shouldn't be reloading, but we are
         console.log(`Correcting reload state for gun ${this.id} - stopping reload`);
         this.cancelReload();
      }
   }
}
