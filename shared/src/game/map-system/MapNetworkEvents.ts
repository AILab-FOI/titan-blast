// shared/src/game/map-system/network/MapNetworkEvents.ts

/**
 * Extended ServerBound events for map system
 */
export enum MapServerBound {
   RequestChunks = 'requestChunks', // Request chunks from server
   UpdateTile = 'updateTile', // Update a tile (e.g., from player action)
   CollectResource = 'collectResource', // Collect resource from a tile
   DamageElement = 'damageElement', // Apply damage to a map element
}

/**
 * Extended ClientBound events for map system
 */
export enum MapClientBound {
   UpdateChunks = 'updateChunks', // Update chunks (initial load or updates)
   UpdateTiles = 'updateTiles', // Update specific tiles
   ResourceUpdate = 'resourceUpdate', // Update resource state
}

/**
 * Interface for tile update data
 */
export interface TileUpdateData {
   tileX: number;
   tileY: number;
   updates: any;
}

/**
 * Interface for chunked tile updates from server
 */
export interface ChunkTileUpdates {
   chunkKey: string;
   tileUpdates: TileUpdateData[];
}

/**
 * Interface for resource collection request
 */
export interface ResourceCollectionRequest {
   tileX: number;
   tileY: number;
   amount: number;
}

/**
 * Interface for resource collection response
 */
export interface ResourceCollectionResponse {
   tileX: number;
   tileY: number;
   success: boolean;
   newAmount: number;
   newState: string;
   stabilityGained: number;
}

/**
 * Interface for map element damage request
 */
export interface MapElementDamageRequest {
   elementId: string;
   amount: number;
}

/**
 * Interface for map element damage response
 */
export interface MapElementDamageResponse {
   elementId: string;
   destroyed: boolean;
   newDurability: number;
}
