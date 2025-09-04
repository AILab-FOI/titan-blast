// shared/src/game/map-system/MapTypes.ts

import { Position } from '../Position';

/**
 * Tile types that affect gameplay
 */
export enum TileType {
   Ground = 'ground',
   Wall = 'wall',
}

/**
 * Map layers used for organizing map elements
 */
export enum MapLayer {
   Ground = 0,
   Walls = 1,
   Decorations = 2,
   PlayerSpawnPoints = 3,
}

/**
 * Interface for a single tile within a chunk
 */
export interface Tile {
   tileType: TileType;
   position: Position; // World position of this tile
   walkable: boolean;
   tileId: number; // The tile ID from Tiled (0-based, 0 means empty)
}

/**
 * Interface for serialized map chunk data sent over network
 */
export interface SerializedMapChunk {
   chunkX: number;
   chunkY: number;
   tiles: SerializedTile[];
   timestamp: number;
   version: number;
}

/**
 * Lightweight representation of a tile for network transmission
 */
export interface SerializedTile {
   x: number; // Local X position within chunk
   y: number; // Local Y position within chunk
   tileId: number; // The tile ID from Tiled
   walkable: boolean;
}

/**
 * Interface for a chunk request from client to server
 */
export interface ChunkRequest {
   chunkX: number;
   chunkY: number;
   priority: number;
}
/**
 * Map metadata sent from server to client
 */
export interface MapMetadata {
   mapId: string;
   mapName: string;
   width: number; // in tiles
   height: number; // in tiles
   tileWidth: number; // in pixels
   tileHeight: number; // in pixels
   tilesetPath?: string; // Path to tileset image
}
