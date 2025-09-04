// shared/src/game/map-system/MapDefinition.ts

import { TiledMap } from './TiledMapLoader';

/**
 * Simplified map definition for Tiled-based maps
 */
export interface MapDefinition {
   id: string;
   name: string;
   width: number; // In tiles
   height: number; // In tiles
   tileWidth: number; // Tile size in pixels
   tileHeight: number; // Tile size in pixels

   // Layer data from Tiled
   groundLayerData: number[]; // Tile IDs for ground layer
   wallsLayerData: number[]; // Tile IDs for walls layer
   decorationsLayerData?: number[]; // Optional decorations layer

   // Player spawn points in world coordinates
   playerSpawnPoints: { x: number; y: number }[];

   // Original Tiled map data for reference
   originalTiledMap?: TiledMap;
}
