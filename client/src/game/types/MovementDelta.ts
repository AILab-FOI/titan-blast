export interface MovementDelta {
   velocityDelta: { x: number; y: number };
   angularVelocityDelta: number;
   positionDelta: { x: number; y: number };
   rotationDelta: number;
   timestamp: number;
}
