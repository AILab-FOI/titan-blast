import type * as RAPIER from '@dimforge/rapier2d-compat';
import { Position } from './Position';
import { Entity } from './Entity';
import { physicsToPixel, pixelToPhysics } from '../util/Utils';
import { MathUtil } from '../util/MathUtil';

export abstract class MovableEntity extends Entity {
   protected rapier: typeof RAPIER;

   /**
    * Creates a new MovableEntity instance
    * @param world - The RAPIER physics world this entity exists in
    * @param body - The RAPIER physics body for this entity
    * @param rapier - The RAPIER physics engine instance
    * @param id - Optional unique identifier for this entity
    */
   constructor(world: RAPIER.World, rapier: typeof RAPIER, id?: string) {
      super(world, id);
      this.rapier = rapier;
   }

   /**
    * Applies an instantaneous force impulse to this entity in PIXELS
    * The force will be converted to physics units internally
    * @param force - The force vector in pixels to apply {x, y}
    */
   public applyForce(force: { x: number; y: number }): void {
      this.body.applyImpulse(force, true);
   }

   /**
    * Applies an angular impulse (rotational force) to this entity
    * @param torque - The magnitude of the rotational force to apply in radians
    */
   public applyTorque(torque: number) {
      this.body.applyTorqueImpulse(torque, true);
   }

   /**
    * Sets the velocity of this entity in PIXELS
    * The velocity will be converted to physics units internally
    * @param velocity - The velocity vector in pixels {x, y}
    */
   public setVelocity(velocity: { x: number; y: number }): void {
      const physicsVel = {
         x: pixelToPhysics(velocity.x),
         y: pixelToPhysics(velocity.y),
      };
      this.body.setLinvel(physicsVel, true);
   }

   /**
    * Sets the angular velocity (rotational speed) of this entity
    * @param angularForce - The angular velocity in radians per second
    */
   public setAngularVelocity(angularForce: number) {
      this.body.setAngvel(angularForce, true);
   }

   public get angularVelocity() {
      return this.body.angvel();
   }

   /**
    * Sets the position of this entity in PIXELS
    * The position will be converted to physics units internally
    * @param newPosition - The new position in pixels {x, y}
    */
   public setPosition(newPosition: Position) {
      const physicsPos = {
         x: pixelToPhysics(newPosition.x),
         y: pixelToPhysics(newPosition.y),
      };
      this.body.setTranslation(physicsPos, true);
   }

   /**
    * Sets the rotation of this entity
    * @param rotation - The rotation angle in degrees
    */
   public setRotation(rotation: number) {
      this.body.setRotation(rotation, true);
   }

   /**
    * Gets the current rotation of this entity
    * @returns The current rotation in degrees
    */
   public get rotationDegrees(): number {
      return MathUtil.radiansToDegrees(this.body.rotation());
   }

   public get rotationRadians(): number {
      return this.body.rotation();
   }

   /**
    * Gets the current velocity of this entity in PIXELS
    * @returns The current velocity vector in pixels
    */
   public get velocity(): { x: number; y: number } {
      const physicsVel = this.body.linvel();
      return {
         x: physicsToPixel(physicsVel.x),
         y: physicsToPixel(physicsVel.y),
      };
   }
}
