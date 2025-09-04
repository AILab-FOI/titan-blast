// shared/src/game/network/messages/ReloadMessages.ts

export interface ReloadRequest {
   username: string;
   reloadTick: number;
}

export interface ReloadEvent {
   playerId: string;
   gunId: string;
   eventType: 'started' | 'completed';
   tick: number;
   newAmmoCount?: number; // Only for completed events
}

export interface GunStateSync {
   playerId: string;
   gunId: string;
   currentAmmo: number;
   isReloading: boolean;
   reloadStartTick?: number;
   reloadDurationTicks?: number;
}
