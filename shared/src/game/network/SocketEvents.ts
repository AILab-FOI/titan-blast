import { PlayerAimData } from './messages/server-bound/PlayerAimData';
import { PlayerJoinData } from './messages/client-bound/PlayerDataToSend';
import { ShootRequest } from './messages/ShootingParams';
import { PlayerMovementState } from './messages/client-bound/PlayerMovementState';
import { GameStartData } from './messages/client-bound/GameStartData';
import { PlayerMoveRequest } from './messages/server-bound/PlayerMoveRequest';
import { ServerShootEventData } from './messages/client-bound/ServerShootEventData';
import { PlayerData } from '../PlayerData';
import { ChunkRequest, SerializedMapChunk } from '../map-system/MapTypes';
import {
   ChunkTileUpdates,
   MapElementDamageRequest,
   ResourceCollectionRequest,
   ResourceCollectionResponse,
   TileUpdateData,
} from '../map-system/MapNetworkEvents';
import { MapInfoData } from './messages/client-bound/MapInfoData';
import { ServerMetricsData } from './messages/client-bound/ServerMetricsData';
import {
   EnemyAbilityData,
   EnemyAIDebugData,
   EnemyDeathData,
   EnemyDespawnData,
   EnemySpawnData,
   EnemyTargetRequest,
   EnemyUpdateData,
   ExplosionEffectData,
   ProjectileSpawnData,
} from './messages/EnemyNetworkEvents';
import { Position } from '../Position';
import { PingRequestData, PingResponseData } from './PingSystem';
import { EnemyDamageEventBatch } from './messages/client-bound/DamageEvents';
import { GunStateSync, ReloadEvent, ReloadRequest } from './messages/ReloadMessages';

export enum ServerBound {
   PlayerMove = 'clientPlayerMove',
   PlayerShoot = 'clientPlayerShoot',
   PlayerAim = 'clientPlayerAim',
   PlayerConnect = 'clientPlayerConnect',
   PlayerDisconnect = 'clientPlayerDisconnect',

   // Map system events
   RequestChunks = 'requestChunks',
   UpdateTile = 'updateTile',
   CollectResource = 'collectResource',
   DamageElement = 'damageElement',

   // Enemy system events
   EnemyTargetRequest = 'enemyTargetRequest',
   EnemySyncRequest = 'enemySyncRequest',

   PingRequest = 'pingRequest',
   PlayerReload = 'playerReload',
}

export enum ClientBound {
   UpdateAllPlayers = 'serverUpdateAllPlayers',
   StartGame = 'serverStartGame',
   StopGame = 'serverStopGame',
   PlayerJoin = 'serverPlayerJoin',
   PlayerShoot = 'serverPlayerShoot',
   PlayerDisconnect = 'serverPlayerDisconnect',
   PlayerAim = 'serverPlayerAim',
   // BulletCollision = 'serverBulletCollision',

   // Map system events
   UpdateChunks = 'updateChunks',
   UpdateTiles = 'updateTiles',
   ResourceUpdate = 'resourceUpdate',
   PlayerInfo = 'playerInfo',
   MapInfo = 'mapInfo',

   // Metrics event
   ServerMetrics = 'serverMetrics',

   // Enemy system events
   EnemySpawn = 'enemySpawn',
   EnemyUpdate = 'enemyUpdate',
   EnemyDespawn = 'enemyDespawn',
   EnemyAbility = 'enemyAbility',
   EnemyDeath = 'enemyDeath',
   ExplosionEffect = 'explosionEffect',
   ProjectileSpawn = 'projectileSpawn',
   // DamageAreaSpawn = 'damageAreaSpawn',
   EnemyAIDebug = 'enemyAIDebug',
   EnemySyncResponse = 'enemySyncResponse',
   EnemyDamage = 'enemyDamage',

   PingResponse = 'pingResponse',

   ReloadEvent = 'reloadEvent',
   GunStateSync = 'gunStateSync',
}

export type ReliabilityType = 'reliable' | 'unreliable';

export const EventReliability: Record<string, ReliabilityType> = {
   // Client to server events
   [ServerBound.PlayerConnect]: 'reliable',
   [ServerBound.PlayerDisconnect]: 'reliable',
   // [ServerBound.PlayerShoot]: 'reliable',
   [ServerBound.RequestChunks]: 'reliable',
   [ServerBound.UpdateTile]: 'reliable',
   [ServerBound.CollectResource]: 'reliable',
   [ServerBound.DamageElement]: 'reliable',

   [ServerBound.EnemyTargetRequest]: 'reliable',
   [ServerBound.EnemySyncRequest]: 'reliable',
   [ServerBound.PlayerReload]: 'reliable',

   // Server to client events
   [ClientBound.StartGame]: 'reliable',
   [ClientBound.StopGame]: 'reliable',
   [ClientBound.PlayerJoin]: 'reliable',
   [ClientBound.PlayerDisconnect]: 'reliable',
   // [ClientBound.PlayerShoot]: 'reliable',
   [ClientBound.UpdateChunks]: 'reliable',
   [ClientBound.UpdateTiles]: 'reliable',
   [ClientBound.ResourceUpdate]: 'reliable',
   [ClientBound.MapInfo]: 'reliable',

   [ClientBound.EnemySpawn]: 'reliable',
   [ClientBound.EnemyDespawn]: 'reliable',
   [ClientBound.EnemyAbility]: 'reliable',
   [ClientBound.EnemyDeath]: 'reliable',
   [ClientBound.ExplosionEffect]: 'reliable',
   [ClientBound.ProjectileSpawn]: 'reliable',
   // [ClientBound.DamageAreaSpawn]: 'reliable',
   [ClientBound.EnemySyncResponse]: 'reliable',
   [ClientBound.ReloadEvent]: 'reliable',

   // All other events are unreliable by default
};

export enum MessageTiming {
   PreGame, // Must be processed immediately, even before game starts
   GameLoop, // Should be processed during the game loop
   Hybrid,
}

export const EventTiming: Record<string, MessageTiming> = {
   // Client to server pre-game events
   [ServerBound.PlayerConnect]: MessageTiming.PreGame,
   [ServerBound.PlayerDisconnect]: MessageTiming.PreGame,

   // Server to client pre-game events
   [ClientBound.PlayerJoin]: MessageTiming.PreGame,
   [ClientBound.StartGame]: MessageTiming.PreGame,
   [ClientBound.StopGame]: MessageTiming.PreGame,
   [ClientBound.PlayerDisconnect]: MessageTiming.PreGame,

   [ClientBound.UpdateChunks]: MessageTiming.Hybrid,
   [ClientBound.MapInfo]: MessageTiming.PreGame,

   [ServerBound.PingRequest]: MessageTiming.PreGame,
   [ClientBound.PingResponse]: MessageTiming.PreGame,
   // All other events default to game loop timing
};

export function isPreGameEvent(eventType: ServerBound | ClientBound): boolean {
   return EventTiming[eventType] === MessageTiming.PreGame;
}

export function isHybridEvent(eventType: ServerBound | ClientBound): boolean {
   return EventTiming[eventType] === MessageTiming.Hybrid;
}

export type ChannelId = string | undefined;

export interface EventDataMap {
   [ClientBound.UpdateAllPlayers]: PlayerMovementState[];
   [ClientBound.StartGame]: GameStartData;
   [ClientBound.StopGame]: string;
   [ClientBound.PlayerJoin]: PlayerJoinData;
   [ClientBound.PlayerShoot]: ServerShootEventData;
   [ClientBound.PlayerAim]: PlayerAimData;
   [ClientBound.PlayerDisconnect]: string;
   // [ClientBound.BulletCollision]: string;
   [ClientBound.UpdateChunks]: SerializedMapChunk[];
   [ClientBound.UpdateTiles]: ChunkTileUpdates;
   [ClientBound.ResourceUpdate]: ResourceCollectionResponse;

   [ClientBound.PlayerInfo]: { playerId: string };
   [ClientBound.MapInfo]: MapInfoData;
   [ClientBound.ServerMetrics]: ServerMetricsData;

   // Enemy system events
   [ClientBound.EnemySpawn]: EnemySpawnData;
   [ClientBound.EnemyUpdate]: EnemyUpdateData;
   [ClientBound.EnemyDespawn]: EnemyDespawnData;
   [ClientBound.EnemyAbility]: EnemyAbilityData;
   [ClientBound.EnemyDeath]: EnemyDeathData;
   [ClientBound.ExplosionEffect]: ExplosionEffectData;
   [ClientBound.ProjectileSpawn]: ProjectileSpawnData;
   // [ClientBound.DamageAreaSpawn]: DamageAreaSpawnData;
   [ClientBound.EnemyAIDebug]: EnemyAIDebugData;
   [ClientBound.EnemySyncResponse]: { requestId: string; enemies: any[] };
   [ClientBound.EnemyDamage]: EnemyDamageEventBatch;
   [ClientBound.PingResponse]: PingResponseData;
   [ClientBound.ReloadEvent]: ReloadEvent;
   [ClientBound.GunStateSync]: GunStateSync;

   [ServerBound.PlayerMove]: PlayerMoveRequest[];
   [ServerBound.PlayerShoot]: ShootRequest;
   [ServerBound.PlayerConnect]: {
      userInfo: PlayerData;
      // channelId?: string | ChannelId; // Make channelId optional to avoid TypeScript errors
   };
   [ServerBound.PlayerDisconnect]: {
      reason?: string;
      username: string;
      channelId?: string | ChannelId; // Make channelId optional
   };
   [ServerBound.PlayerAim]: PlayerAimData;

   [ServerBound.RequestChunks]: ChunkRequest[];
   [ServerBound.UpdateTile]: TileUpdateData;
   [ServerBound.CollectResource]: ResourceCollectionRequest;
   [ServerBound.DamageElement]: MapElementDamageRequest;

   [ServerBound.EnemyTargetRequest]: EnemyTargetRequest;
   [ServerBound.EnemySyncRequest]: { requestId: string; playerPosition: Position };
   [ServerBound.PlayerReload]: ReloadRequest;

   [ServerBound.PingRequest]: PingRequestData;
}
