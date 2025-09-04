// server/src/map-system/maps/TiledMapDefinition.ts
import { TiledMapLoader } from 'shared/game/map-system/TiledMapLoader';
import { MapDefinition } from 'shared/game/map-system/MapDefinition';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Load the FirstTiledMap.tmj file and convert it to our internal MapDefinition
 */
export function loadFirstTiledMap(): MapDefinition {
   // Path to the TMJ file
   const tmjFilePath = path.join(__dirname, 'Map2.tmj');

   try {
      // Read and parse the TMJ file
      const tmjContent = fs.readFileSync(tmjFilePath, 'utf8');
      const tiledMapData = JSON.parse(tmjContent);

      // Convert using our TiledMapLoader
      const mapDefinition = TiledMapLoader.loadFromTiledMap(tiledMapData);

      // Set a proper name and ID for this specific map
      mapDefinition.id = 'first-tiled-map';
      mapDefinition.name = 'First Tiled Map';

      console.log(`Loaded Tiled map: ${mapDefinition.name} (${mapDefinition.width}x${mapDefinition.height} tiles)`);
      console.log(`Tile size: ${mapDefinition?.tileWidth}x${mapDefinition?.tileHeight}px`);
      console.log(`Spawn points: ${mapDefinition.playerSpawnPoints?.length || 0}`);

      return mapDefinition;
   } catch (error) {
      console.error('Failed to load FirstTiledMap.tmj:', error);
      throw new Error(`Could not load Tiled map from ${tmjFilePath}: ${error}`);
   }
}

/**
 * Generic function to load any TMJ file from the maps directory
 */
export function loadTiledMapFromFile(filename: string): MapDefinition {
   const tmjFilePath = path.join(__dirname, filename);

   try {
      const tmjContent = fs.readFileSync(tmjFilePath, 'utf8');
      const tiledMapData = JSON.parse(tmjContent);

      const mapDefinition = TiledMapLoader.loadFromTiledMap(tiledMapData);

      // Use filename (without extension) as the map ID
      const mapId = path.basename(filename, path.extname(filename));
      mapDefinition.id = mapId;
      mapDefinition.name = mapId.replace(/([A-Z])/g, ' $1').trim(); // Convert camelCase to readable name

      return mapDefinition;
   } catch (error) {
      console.error(`Failed to load ${filename}:`, error);
      throw new Error(`Could not load Tiled map from ${filename}: ${error}`);
   }
}

/**
 * Get all available TMJ maps in the maps directory
 */
export function getAvailableMaps(): string[] {
   const mapsDir = __dirname;

   try {
      const files = fs.readdirSync(mapsDir);
      return files.filter((file) => file.endsWith('.tmj'));
   } catch (error) {
      console.error('Failed to read maps directory:', error);
      return [];
   }
}
