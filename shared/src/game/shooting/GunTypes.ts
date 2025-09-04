import { AnimationCurveType } from '../animation/AnimationCurves';

export enum GunType {
   PISTOL = 'pistol',
   ASSAULT_RIFLE = 'assault_rifle',
   SNIPER = 'sniper',
   TANK_RIFLE = 'tank_rifle',
   SHOTGUN = 'shotgun',
}

export type GunConfig = {
   damage: number;
   penetration: number;
   automatic: boolean;
   magazineSize: number;
   shootDelayTicks: number;
   accuracy: number;
   reloadTimeTicks: number;
   width: number;
   height: number;
   gunTextureName: string;
   bulletTextureName: string;
   bulletWidth: number;
   bulletHeight: number;
   pelletCount?: number;
   bulletVisual: BulletVisualConfig;

   damageRanges: {
      fullDamage: number; // Distance up to which gun deals full damage (pixels)
      falloffEnd: number; // Distance where damage reaches minimum (pixels)
      maxRange: number; // Maximum range beyond which bullets disappear (pixels)
   };
   damageFalloff: {
      minimumDamagePercent: number; // Minimum damage percentage at falloffEnd (0.0 to 1.0)
   };
};

export interface BulletVisualConfig {
   duration: number; // Fixed duration in milliseconds
   animationCurve: AnimationCurveType;
}

export const GUN_CONFIGS: { [key: string]: GunConfig } = {
   [GunType.PISTOL]: {
      damage: 10,
      penetration: 10,
      automatic: false,
      magazineSize: 12,
      shootDelayTicks: 7,
      accuracy: 1,
      reloadTimeTicks: 50,
      width: 30,
      height: 8,
      gunTextureName: 'DEagle_0.png',
      bulletTextureName: '15.png',
      bulletWidth: 0.1,
      bulletHeight: 0.6,
      damageRanges: {
         fullDamage: 200,
         falloffEnd: 500,
         maxRange: 800,
      },
      damageFalloff: {
         minimumDamagePercent: 0.4, // 40% damage at max falloff
      },
      bulletVisual: {
         duration: 150, // 150ms travel time
         animationCurve: 'easeOutQuart', // Current curve
      },
   },
   [GunType.ASSAULT_RIFLE]: {
      damage: 12,
      penetration: 5,
      automatic: true,
      magazineSize: 1000,
      shootDelayTicks: 2,
      accuracy: 0.8,
      reloadTimeTicks: 50,
      width: 60,
      height: 20,
      gunTextureName: '417_00.png',
      bulletTextureName: '15.png',
      bulletWidth: 0.15,
      bulletHeight: 0.8,
      pelletCount: 1,
      damageRanges: {
         fullDamage: 300,
         falloffEnd: 700,
         maxRange: 1200,
      },
      damageFalloff: {
         minimumDamagePercent: 0.3, // 30% damage at max falloff
      },
      bulletVisual: {
         duration: 200, // Faster for assault rifle
         animationCurve: 'smoothStep', // More direct/aggressive feel
      },
   },
   [GunType.SNIPER]: {
      damage: 50,
      penetration: 50,
      automatic: false,
      magazineSize: 5,
      shootDelayTicks: 30,
      accuracy: 1,
      reloadTimeTicks: 50,
      width: 80,
      height: 25,
      gunTextureName: 'AWP_00.png',
      bulletTextureName: '15.png',
      bulletWidth: 0.25,
      bulletHeight: 2,
      damageRanges: {
         fullDamage: 600,
         falloffEnd: 1200,
         maxRange: 2000,
      },
      damageFalloff: {
         minimumDamagePercent: 0.6, // 60% damage at max falloff (sniper maintains damage better)
      },
      bulletVisual: {
         duration: 80, // Very fast for sniper
         animationCurve: 'easeOutCubic', // Smooth but fast
      },
   },
   [GunType.SHOTGUN]: {
      damage: 4,
      penetration: 5,
      automatic: true,
      magazineSize: 100,
      shootDelayTicks: 6,
      accuracy: 3,
      reloadTimeTicks: 50,
      width: 60,
      height: 20,
      gunTextureName: 'FAMAS_00.png',
      bulletTextureName: '15.png',
      bulletWidth: 0.12,
      bulletHeight: 1.2,
      pelletCount: 7,
      damageRanges: {
         fullDamage: 150,
         falloffEnd: 300,
         maxRange: 500,
      },
      damageFalloff: {
         minimumDamagePercent: 0.3, // 20% damage at max falloff (shotgun drops off quickly)
      },
      bulletVisual: {
         duration: 250, // Slower for shotgun
         animationCurve: 'easeInOutQuart', // More dramatic curve
      },
   },
};
