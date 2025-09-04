import { Player } from '../Player';
import { LocalShootResult, PelletResult, RaycastHit, ShootResult } from '../network/messages/ShootingParams';
import { GUN_CONFIGS, GunConfig, GunType } from './GunTypes';
import { Position } from '../Position';
import type * as RAPIER from '@dimforge/rapier2d-compat';
import { MathUtil } from '../../util/MathUtil';
import { gameSettings } from '../SystemSettings';
import { physicsToPixel, pixelToPhysics } from '../../util/Utils';
import { ProjectileHit } from './ProjectileHit';
import { BaseGame } from '../BaseGame';
import { DamageService } from './DamageService';
import { TaskPriority } from '../../util/TaskScheduler';

export abstract class Gun {
   protected game: BaseGame;
   protected world: RAPIER.World;
   protected rapier: typeof RAPIER;
   protected player: Player;
   protected _gunType;
   protected _damage: number;
   protected penetration: number;
   protected magazineSize: number;
   protected currentAmmo: number;
   protected automatic: boolean;
   protected shootDelayTicks: number;
   protected reloadTimeTicks: number;
   protected lastShotTick: number = 0;
   protected accuracy: number;
   protected width: number;
   protected height: number;
   protected positionOffset: Position;
   protected readonly gunConfig: GunConfig;
   public readonly id: string;
   protected lastBulletTickCount: Map<number, number> = new Map();

   protected reloading: boolean = false;
   protected reloadStartTick: number = 0;
   protected reloadDurationTicks: number;
   protected reloadTaskId: string | null = null; // For task scheduler

   constructor(
      game: BaseGame,
      world: RAPIER.World,
      rapier: typeof RAPIER,
      player: Player,
      gunType: GunType,
      positionOffset: Position,
   ) {
      this.game = game;
      this.player = player;
      this.gunConfig = GUN_CONFIGS[gunType];
      this._gunType = gunType;
      this._damage = this.gunConfig.damage;
      this.penetration = this.gunConfig.penetration;
      this.automatic = this.gunConfig.automatic;
      this.magazineSize = this.gunConfig.magazineSize;
      this.currentAmmo = this.gunConfig.magazineSize;
      this.shootDelayTicks = this.gunConfig.shootDelayTicks;
      this.reloadTimeTicks = this.gunConfig.reloadTimeTicks;
      this.accuracy = this.gunConfig.accuracy;

      this.width = this.gunConfig.width;
      this.height = this.gunConfig.height;
      this.positionOffset = positionOffset;
      this.world = world;
      this.rapier = rapier;
      this.id = `${this.player.username}-${gunType}`;

      this.reloadDurationTicks = this.gunConfig.reloadTimeTicks;
   }

   public canShoot(currentTick: number): boolean {
      return !this.isReloading() && !this.isOutOfAmmo() && !this.isOnShootDelay(currentTick);
   }

   protected shoot(currentTick: number, origin: Position, angle: number): ShootResult | null {
      if (!this.canShoot(currentTick)) {
         console.log('📛 GUN CANT SHOOT!!!');
         return null;
      }

      const bulletIndex = this.getBulletIndexForTick(currentTick);
      const pelletCount = this.gunConfig.pelletCount || 1;
      const pelletAngles = this.calculatePelletAngles(angle, currentTick, bulletIndex, pelletCount);
      pelletAngles.forEach((pelletAngle) => console.log(pelletAngle));

      const pelletResults: PelletResult[] = [];
      const allHits: ProjectileHit[] = [];

      pelletAngles.forEach((pelletAngle) => {
         const pelletHits = this.calculatePelletHits(origin, pelletAngle);
         pelletResults.push({
            angle: pelletAngle,
            hits: this.convertProjectileHitsToRaycastHits(pelletHits),
         });
         allHits.push(...pelletHits);
      });

      this.updateGunState(currentTick);

      this.processHits(allHits);

      const localResult: LocalShootResult = {
         gunId: this.id,
         origin,
         angle,
         bulletIndex,
         hits: this.convertProjectileHitsToRaycastHits(allHits),
         pelletResults,
      };

      console.log(
         `SHOT BULLET: tick:${this.game.getPhysicsManager().getGameTick()}, timestamp: ${this.game.getPhysicsManager().getCurrentTime()}`,
      );

      this.onShoot(localResult);

      // Strip local-only data before returning to prevent sending that over the network
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pelletResults: _, ...networkResult } = localResult;
      return networkResult;
   }

   /**
    * Convert ProjectileHit to RaycastHit for network transmission
    * RaycastHit has fewer properties and is more suitable for network sync
    */
   private convertProjectileHitsToRaycastHits(projectileHits: ProjectileHit[]): RaycastHit[] {
      return projectileHits.map((hit) => ({
         position: hit.position,
         normal: hit.normal,
         distance: hit.distance,
         entityId: hit.entity?.id,
      }));
   }

   protected calculatePelletHits(origin: Position, pelletAngle: number): ProjectileHit[] {
      const physicsOrigin = {
         x: pixelToPhysics(origin.x),
         y: pixelToPhysics(origin.y),
      };

      const direction = {
         x: Math.cos(pelletAngle),
         y: Math.sin(pelletAngle),
      };

      const ray = new this.rapier.Ray(physicsOrigin, direction);

      // Use gun's max range for consistency with damage system
      const maxRangePhysics = pixelToPhysics(this.gunConfig.damageRanges.maxRange);
      const unsortedHits: ProjectileHit[] = [];

      const shooterRigidBody = this.player.body;

      const isShotgun = (this.gunConfig.pelletCount || 1) > 1;

      // Collect all intersections for this pellet
      this.world.intersectionsWithRay(
         ray,
         maxRangePhysics,
         false,
         (hit) => {
            const hitPoint = ray.pointAt(hit.timeOfImpact);
            const distance = physicsToPixel(hit.timeOfImpact);

            // Only include hits within effective range
            if (DamageService.isWithinRange(distance, this.gunConfig)) {
               // Get the actual game entity from EntityManager
               const entity = this.game.getEntityManager().getEntityByCollider(hit.collider.handle);

               const projectileHit: ProjectileHit = {
                  position: {
                     x: physicsToPixel(hitPoint.x),
                     y: physicsToPixel(hitPoint.y),
                  },
                  normal: hit.normal,
                  distance,
                  timeOfImpact: hit.timeOfImpact,
                  entity, // Now properly resolved game entity
                  colliderHandle: hit.collider.handle,
                  penetrationLeft: this.penetration,
               };

               unsortedHits.push(projectileHit);
            }

            return true;
         },
         undefined,
         undefined,
         undefined,
         shooterRigidBody,
      );

      // Sort hits by distance
      const sortedHits = unsortedHits.sort((a, b) => a.timeOfImpact - b.timeOfImpact);
      if (isShotgun) {
         // SHOTGUN: Return only the first hit (closest to shooter)
         // This could be an enemy (entity !== null) or a wall (entity === null)
         return sortedHits.length > 0 ? [sortedHits[0]] : [];
      } else {
         // NON-SHOTGUN: Use the existing penetration logic
         return this.processHitsForPenetration(sortedHits);
      }
      return this.processHitsForPenetration(sortedHits);
   }

   protected processHitsForPenetration(sortedHits: ProjectileHit[]): ProjectileHit[] {
      const finalHits: ProjectileHit[] = [];
      let penetrationPowerLeft = this.penetration;

      for (const hit of sortedHits) {
         hit.penetrationLeft = penetrationPowerLeft;
         finalHits.push(hit);

         // STOP IMMEDIATELY if entity is null (map element/wall)
         if (hit.entity === null) {
            console.log(`🚧 Bullet stopped by static map element at distance ${hit.distance.toFixed(1)}px`);
            break; // Stop processing any further hits
         }

         // Calculate armor and reduce penetration power
         const entityArmor = this.isBackendGun()
            ? DamageService.getEntityArmor(hit.entity) // Backend uses DamageService
            : this.getBasicEntityArmor(hit.entity); // Frontend uses basic method

         penetrationPowerLeft = this.isBackendGun()
            ? DamageService.calculatePenetrationAfterHit(penetrationPowerLeft, entityArmor)
            : Math.max(0, penetrationPowerLeft - entityArmor);

         // Stop processing hits if we can't penetrate further
         if (penetrationPowerLeft <= 0) {
            break;
         }
      }

      return finalHits;
   }

   /**
    * Method to check if this is a backend gun (to be overridden)
    */
   protected isBackendGun(): boolean {
      return false;
   }

   /**
    * Getter for gun config (useful for damage calculations)
    */
   public getGunConfig() {
      return this.gunConfig;
   }

   /**
    * Getter for damage (useful for damage calculations)
    */
   public getDamage(): number {
      return this._damage;
   }

   /**
    * Getter for penetration (useful for damage calculations)
    */
   public getPenetration(): number {
      return this.penetration;
   }

   /**
    * Basic armor getter for shared use
    */
   protected getBasicEntityArmor(entity: any): number {
      if (!entity) return 0;

      if ('properties' in entity && entity.properties && 'armor' in entity.properties) {
         return entity.properties.armor;
      }

      if ('armor' in entity) {
         return entity.armor;
      }

      return 0;
   }

   private updateGunState(currentTick: number): void {
      this.currentAmmo--;
      this.lastShotTick = currentTick;

      // Auto-reload when out of ammo
      if (this.isOutOfAmmo()) {
         this.startReload(currentTick);
      }
   }

   protected processHits(hits: ProjectileHit[]): void {
      hits.forEach((hit) => {
         // this.damageService.applyDamage(hit.entity, this.damage);

         // Call entity's onHit handler if it exists
         if (hit.entity && 'onHit' in hit.entity) {
            (hit.entity as any).onHit(hit);
         }
      });
   }

   protected calculateFinalAngle(rotation: number, currentTick: number, bulletIndex: number): number {
      let finalAngle = rotation;

      // Apply accuracy/spread in a deterministic way
      if (this.accuracy < 100) {
         const maxSpread = (((1 - this.accuracy) * Math.PI) / 180) * 10; // Convert to radians
         const spread = this.getBulletDeviation(currentTick, bulletIndex) * maxSpread;
         finalAngle += spread;
      }

      return finalAngle;
   }

   protected getBulletDeviation(shootTick: number, bulletIndex: number) {
      const seed = this.generateSeed(shootTick, bulletIndex);
      const random = MathUtil.mulberry32(seed); // PRNG instance

      // Ensure accuracy does not go below 1 (to prevent divide-by-zero)
      const accuracy = Math.max(1, this.gunConfig.accuracy);

      // Spread formula: Lower accuracy means higher spread
      const spreadFactor = accuracy >= 100 ? 0 : gameSettings.maxGunSpreadDegrees * ((100 - accuracy) / 100);
      const angleOffsetDegrees = (random() - 0.5) * spreadFactor; // Spread within ±spreadFactor/2 degrees

      // Convert degrees to radians
      return MathUtil.degreesToRadians(angleOffsetDegrees);
   }

   protected getBulletIndexForTick(tick: number): number {
      // Clean up old ticks (optional, to prevent Map from growing indefinitely)
      if (tick % 100 === 0) {
         // Clean up every 100 ticks
         for (const [oldTick] of this.lastBulletTickCount) {
            if (oldTick < tick - 100) {
               // Remove counts older than 100 ticks
               this.lastBulletTickCount.delete(oldTick);
            }
         }
      }

      // Get current count for this tick
      const currentCount = this.lastBulletTickCount.get(tick) || 0;

      // Increment and store
      this.lastBulletTickCount.set(tick, currentCount + 1);

      return currentCount;
   }

   isReloading(): boolean {
      return this.reloading;
   }

   isOutOfAmmo(): boolean {
      return this.currentAmmo === 0;
   }

   isOnShootDelay(currentTick: number): boolean {
      return currentTick - this.lastShotTick <= this.shootDelayTicks;
   }

   isAutomatic(): boolean {
      return this.automatic;
   }

   reload() {
      if (!this.reloading && this.currentAmmo < this.magazineSize) {
         const start = Date.now();
         console.log('STARTED RELOADING AT', start);
         this.reloading = true;
         setTimeout(() => {
            this.currentAmmo = this.magazineSize;
            this.reloading = false;
            console.log('STOPPED RELOADING AT', Date.now() - start);
         }, this.reloadTimeTicks);
      }
   }

   public get damage(): number {
      return this._damage;
   }

   get gunType() {
      return this._gunType;
   }

   protected calculatePelletAngles(
      baseAngle: number,
      currentTick: number,
      bulletIndex: number,
      pelletCount: number,
   ): number[] {
      if (pelletCount <= 1) {
         // Regular gun - just return the calculated final angle
         return [this.calculateFinalAngle(baseAngle, currentTick, bulletIndex)];
      }

      // For shotguns, calculate angles for each pellet
      const angles: number[] = [];

      for (let i = 0; i < pelletCount; i++) {
         // Calculate final angle for each pellet using existing accuracy-based spread
         const finalAngle = this.calculateFinalAngle(baseAngle, currentTick, bulletIndex * pelletCount + i);

         angles.push(finalAngle);
      }

      return angles;
   }

   protected generateSeed(currentTick: number, bulletIndex: number): number {
      // Convert gunId to a number using a hash function
      const gunIdHash = MathUtil.hashStringToNumber(this.id);

      // Combine tick, bulletIndex, and gunIdHash to create a unique seed
      // Use bitwise operations to mix the values
      return (currentTick << 16) ^ (bulletIndex << 8) ^ gunIdHash;
   }

   protected abstract onShoot(result: ShootResult): void;

   /**
    * Start reload - now tick-based and supports manual reload
    */
   public startReload(currentTick: number): boolean {
      // Don't start reload if already reloading or magazine is full
      if (this.reloading || this.currentAmmo >= this.magazineSize) {
         return false;
      }

      console.log('STARTED RELOADING AT TICK', currentTick);
      this.reloading = true;
      this.reloadStartTick = currentTick;

      // Schedule reload completion using task scheduler
      this.reloadTaskId = this.game
         .getPhysicsManager()
         .scheduleTask(
            () => this.completeReload(currentTick + this.reloadDurationTicks),
            TaskPriority.HIGH,
            this.reloadDurationTicks,
         );

      // Emit reload started event for networking
      this.onReloadStarted(currentTick);

      return true;
   }

   /**
    * Complete the reload
    */
   protected completeReload(completionTick: number): void {
      if (!this.reloading) return; // Already completed or cancelled

      console.log('COMPLETED RELOADING AT TICK', completionTick);
      this.currentAmmo = this.magazineSize;
      this.reloading = false;
      this.reloadStartTick = 0;
      this.reloadTaskId = null;

      // Emit reload completed event for networking
      this.onReloadCompleted(completionTick);
   }

   /**
    * Cancel reload (if needed for interruptions)
    */
   public cancelReload(): void {
      if (!this.reloading) return;

      if (this.reloadTaskId) {
         this.game.getPhysicsManager().cancelTask(this.reloadTaskId);
         this.reloadTaskId = null;
      }

      this.reloading = false;
      this.reloadStartTick = 0;

      console.log('RELOAD CANCELLED');
   }

   /**
    * Check if gun can be manually reloaded
    */
   public canManualReload(): boolean {
      return !this.reloading && this.currentAmmo < this.magazineSize;
   }

   /**
    * Get reload progress (0.0 to 1.0) for UI
    */
   public getReloadProgress(currentTick: number): number {
      if (!this.reloading) return 1.0;

      const ticksElapsed = currentTick - this.reloadStartTick;
      return Math.min(1.0, ticksElapsed / this.reloadDurationTicks);
   }

   /**
    * Override in subclasses for network events
    */
   protected onReloadStarted(tick: number): void {
      // To be implemented in BackendGun and FrontendGun
   }

   /**
    * Override in subclasses for network events
    */
   protected onReloadCompleted(tick: number): void {
      // To be implemented in BackendGun and FrontendGun
   }

   /**
    * Get current ammo count (for networking)
    */
   public getCurrentAmmo(): number {
      return this.currentAmmo;
   }

   /**
    * Set current ammo (for server sync)
    */
   public setCurrentAmmo(ammo: number): void {
      this.currentAmmo = Math.max(0, Math.min(ammo, this.magazineSize));
   }
}
