import { Gun } from 'shared/game/shooting/Gun';
import { ShootResult } from '../../shared/src/game/network/messages/ShootingParams';
import { Position } from 'shared/game/Position';
import { ProjectileHit } from 'shared/game/shooting/ProjectileHit';
import { DamageService } from 'shared/game/shooting/DamageService';
import { ReloadEvent } from '../../shared/src/game/network/messages/ReloadMessages';
import { BackendGame } from './BackendGame';
import { ClientBound } from 'shared/game/network/SocketEvents';

export class BackendGun extends Gun {
   /**
    * Backend-specific hit processing with damage calculation
    */
   protected processHits(hits: ProjectileHit[]): void {
      // Process damage calculation and application
      const processedHits = DamageService.processHitsWithPenetration(
         hits,
         this._damage,
         this.gunConfig,
         this.penetration,
      );
      console.log(`TICK: ${this.game.getPhysicsManager().getGameTick()}`);

      // Call entity hit handlers for any additional logic
      processedHits.forEach((hit: any) => {
         if (hit.entity && 'onHit' in hit.entity) {
            (hit.entity as any).onHit(hit);
         }
      });
   }

   /**
    * Override parent method to ensure backend behavior
    */
   protected isBackendGun(): boolean {
      return true;
   }

   public validateAndShoot(shootTick: number, origin: Position, angle: number): ShootResult | null {
      // Check basic gun state
      if (!this.canShoot(shootTick)) {
         console.warn(`Gun ${this.id} failed basic canShoot check`);
         return null;
      }

      // TODO: Shoot tick value must not be older than x ticks
      // TODO: shoot tick value must not be older than previuous shot tick
      // TODO: this.shootDelayTicks must pass before being able to shoot again (cant fire faster than gun fire rate)

      /* TODO: perform lag compensation (rollback game state to the given tick from frontend) and then cast rays (call shoot method)
       * Lag compensation should include rollback of enemies to the point of how player saw them when he shot and other moving entities
       */

      // Validate fire rate even for automatic weapons
      const timeSinceLastShot = shootTick - this.lastShotTick;
      if (timeSinceLastShot < this.shootDelayTicks) {
         console.warn(`Gun ${this.id} firing too fast: ${timeSinceLastShot} < ${this.shootDelayTicks}`);
         return null;
      }

      // // Validate bullet index
      // const expectedBulletIndex = this.getBulletIndexForTick(currentTick);
      // if (bulletIndex !== expectedBulletIndex) {
      //    console.warn(
      //       `Gun ${this.id} bullet index mismatch: ${bulletIndex} != ${expectedBulletIndex}`,
      //    );
      //    return null;
      // }
      //
      // // Validate shot origin is close to gun's actual position
      // const expectedOrigin = this.calculateGunPosition();
      // const positionDiff = Math.hypot(origin.x - expectedOrigin.x, origin.y - expectedOrigin.y);
      //
      // if (positionDiff > BackendGun.POSITION_TOLERANCE) {
      //    console.warn(
      //       `Gun ${this.id} position mismatch: ${positionDiff} > ${BackendGun.POSITION_TOLERANCE}`,
      //    );
      //    return null;
      // }
      //
      // // Get the expected angle including gun rotation and container rotation
      // const expectedBaseAngle = this.getGunContainerRotation() + this.getGunRotation();
      //
      // // Calculate the final angle with deviation (using same seed as client)
      // const expectedFinalAngle = this.calculateFinalAngle(
      //    expectedBaseAngle,
      //    currentTick,
      //    bulletIndex,
      // );
      //
      // // Validate angle is within tolerance
      // const angleDiff = Math.abs(MathUtils.shortestAngleBetween(angle, expectedFinalAngle));
      // if (angleDiff > BackendGun.ANGLE_TOLERANCE) {
      //    console.warn(
      //       `Gun ${this.id} angle mismatch: ${angleDiff} > ${BackendGun.ANGLE_TOLERANCE}`,
      //    );
      //    return null;
      // }
      //
      // // If automatic, validate player has permission to auto-fire
      // if (this.automatic) {
      //    if (!this.player.hasAutoFirePermission()) {
      //       console.warn(`Gun ${this.id} unauthorized auto-fire`);
      //       return null;
      //    }
      // }

      // All validations passed, perform the shot
      return this.shoot(shootTick, origin, angle);
   }

   // public validateAndShoot(request: ShootRequest): ShootResult | null {
   //    if (!this.validateShootRequest(request)) {
   //       return null;
   //    }
   //
   //    // Validate the client's bullet index is the same as what we expect
   //    const expectedBulletIndex = this.getBulletIndexForTick(request.shootTick);
   //    if (expectedBulletIndex !== request.bulletIndex) {
   //       console.warn('Client bullet index mismatch');
   //       return null;
   //    }
   //
   //    const origin = this.calculateGunPosition();
   //    const baseRotation = request.containerRotation + request.gunRotation;
   //
   //    return this.shoot(request.shootTick, origin, baseRotation);
   // }

   protected onShoot(result: ShootResult): void {}

   /**
    * Override to broadcast reload started event
    */
   protected onReloadStarted(tick: number): void {
      const reloadEvent: ReloadEvent = {
         playerId: this.player.id,
         gunId: this.id,
         eventType: 'started',
         tick,
      };

      // Get server transport and broadcast to all clients
      const server = this.game as BackendGame;
      server.getServerTransport().broadcast(ClientBound.ReloadEvent, reloadEvent);
   }

   /**
    * Override to broadcast reload completed event
    */
   protected onReloadCompleted(tick: number): void {
      const reloadEvent: ReloadEvent = {
         playerId: this.player.id,
         gunId: this.id,
         eventType: 'completed',
         tick,
         newAmmoCount: this.currentAmmo,
      };

      // Get server transport and broadcast to all clients
      const server = this.game as BackendGame;
      server.getServerTransport().broadcast(ClientBound.ReloadEvent, reloadEvent);
   }

   /**
    * Validate and process manual reload request from client
    */
   public validateManualReload(requestTick: number, currentTick: number): boolean {
      // Allow some tolerance for network latency (1-2 ticks)
      const tickDifference = Math.abs(currentTick - requestTick);
      if (tickDifference > 2) {
         console.warn(`Gun ${this.id} reload request too old: ${tickDifference} ticks difference`);
         return false;
      }

      // Check if reload is valid
      if (!this.canManualReload()) {
         console.warn(`Gun ${this.id} cannot reload: already reloading or magazine full`);
         return false;
      }

      // Start reload using the current server tick for consistency
      return this.startReload(currentTick);
   }
}
