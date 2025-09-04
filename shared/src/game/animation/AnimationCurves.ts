export type AnimationCurveType =
   | 'linear'
   | 'easeOutQuart'
   | 'easeInQuart'
   | 'easeInOutQuart'
   | 'easeOutCubic'
   | 'easeInOutCubic'
   | 'easeOutQuint'
   | 'easeOutExpo'
   | 'smoothStep'
   | 'smootherStep';

export class AnimationCurves {
   static linear(t: number): number {
      return t;
   }

   static easeOutQuart(t: number): number {
      return 1 - Math.pow(1 - t, 4);
   }

   static easeInQuart(t: number): number {
      return Math.pow(t, 4);
   }

   static easeInOutQuart(t: number): number {
      return t < 0.5 ? 8 * Math.pow(t, 4) : 1 - 8 * Math.pow(1 - t, 4);
   }

   static easeOutCubic(t: number): number {
      return 1 - Math.pow(1 - t, 3);
   }

   static easeInOutCubic(t: number): number {
      return t < 0.5 ? 4 * Math.pow(t, 3) : 1 - Math.pow(-2 * t + 2, 3) / 2;
   }

   static easeOutQuint(t: number): number {
      return 1 - Math.pow(1 - t, 5);
   }

   static easeOutExpo(t: number): number {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
   }

   static smoothStep(t: number): number {
      return t * t * (3 - 2 * t);
   }

   static smootherStep(t: number): number {
      return t * t * t * (t * (t * 6 - 15) + 10);
   }

   static getCurveFunction(curveType: AnimationCurveType): (t: number) => number {
      switch (curveType) {
         case 'linear':
            return this.linear;
         case 'easeOutQuart':
            return this.easeOutQuart;
         case 'easeInQuart':
            return this.easeInQuart;
         case 'easeInOutQuart':
            return this.easeInOutQuart;
         case 'easeOutCubic':
            return this.easeOutCubic;
         case 'easeInOutCubic':
            return this.easeInOutCubic;
         case 'easeOutQuint':
            return this.easeOutQuint;
         case 'easeOutExpo':
            return this.easeOutExpo;
         case 'smoothStep':
            return this.smoothStep;
         case 'smootherStep':
            return this.smootherStep;
         default:
            return this.smoothStep;
      }
   }
}
