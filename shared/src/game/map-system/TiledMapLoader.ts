// shared/src/game/map-system/TiledMapLoader.ts

import { MapDefinition } from './MapDefinition';

/**
 * Tiled map format interfaces
 */
export interface TiledLayer {
   data?: number[];
   height: number;
   id: number;
   name: string;
   opacity: number;
   type: 'tilelayer' | 'objectgroup';
   visible: boolean;
   width: number;
   x: number;
   y: number;
   objects?: TiledObject[];
}

export interface TiledObject {
   height: number;
   id: number;
   name: string;
   point?: boolean;
   rotation: number;
   type: string;
   visible: boolean;
   width: number;
   x: number;
   y: number;
}

export interface TiledTileset {
   firstgid: number;
   source: string;
}

export interface TiledMap {
   compressionlevel: number;
   height: number;
   infinite: boolean;
   layers: TiledLayer[];
   nextlayerid: number;
   nextobjectid: number;
   orientation: string;
   renderorder: string;
   tiledversion: string;
   tileheight: number;
   tilesets: TiledTileset[];
   tilewidth: number;
   type: string;
   version: string;
   width: number;
}

/**
 * Loads and converts Tiled maps to our internal MapDefinition format
 */
export class TiledMapLoader {
   /**
    * Load a map from Tiled TMJ format
    */
   public static loadFromTiledMap(tiledMapData: TiledMap): MapDefinition {
      const { width, height, tilewidth, tileheight } = tiledMapData;

      // Find the layers we need
      const groundLayer = tiledMapData.layers.find(
         (layer) => layer.type === 'tilelayer' && layer.name === 'GroundLayer',
      );
      const wallsLayer = tiledMapData.layers.find((layer) => layer.type === 'tilelayer' && layer.name === 'WallsLayer');
      const decorationsLayer = tiledMapData.layers.find(
         (layer) => layer.type === 'tilelayer' && layer.name === 'DecorationsLayer',
      );
      const spawnPointsLayer = tiledMapData.layers.find(
         (layer) => layer.type === 'objectgroup' && layer.name === 'PlayerSpawnPoints',
      );

      if (!groundLayer || !wallsLayer) {
         throw new Error('Required layers (GroundLayer, WallsLayer) not found in Tiled map');
      }

      // Extract spawn points
      const playerSpawnPoints = this.extractSpawnPoints(spawnPointsLayer, tilewidth, tileheight);

      // Create the map definition
      const mapDefinition: MapDefinition = {
         id: `tiled-map-${Date.now()}`,
         name: 'Tiled Map',
         width,
         height,
         tileWidth: tilewidth,
         tileHeight: tileheight,
         groundLayerData: groundLayer.data || [],
         wallsLayerData: wallsLayer.data || [],
         decorationsLayerData: decorationsLayer?.data,
         playerSpawnPoints,
         originalTiledMap: tiledMapData,
      };

      return mapDefinition;
   }

   /**
    * Extract player spawn points from the object layer
    */
   private static extractSpawnPoints(
      spawnPointsLayer: TiledLayer | undefined,
      tileWidth: number,
      tileHeight: number,
   ): { x: number; y: number }[] {
      if (!spawnPointsLayer || !spawnPointsLayer.objects) {
         console.warn('No spawn points layer found, using default spawn points');
         return [
            { x: tileWidth * 2 + tileWidth / 2, y: tileHeight * 2 + tileHeight / 2 },
            { x: tileWidth * 47 + tileWidth / 2, y: tileHeight * 2 + tileHeight / 2 },
            { x: tileWidth * 2 + tileWidth / 2, y: tileHeight * 47 + tileHeight / 2 },
            { x: tileWidth * 47 + tileWidth / 2, y: tileHeight * 47 + tileHeight / 2 },
         ];
      }

      // Tiled objects have their position as world coordinates already
      return spawnPointsLayer.objects
         .filter((obj) => obj.point)
         .map((obj) => ({
            x: obj.x,
            y: obj.y,
         }));
   }
}
