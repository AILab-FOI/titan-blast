import { gameSettings } from '../game/SystemSettings';

export function pixelToPhysics(pixels: number) {
   return pixels / gameSettings.physics.lengthUnit;
}

export function physicsToPixel(tiles: number): number {
   return tiles * gameSettings.physics.lengthUnit;
}

export function getCurrentTimestamp() {
   return performance.now() + performance.timeOrigin;
}

/**
 * Calculate view distance in chunks based on pixel distance and tile size
 *
 * @see gameSettings, gameSettings has viewDistancePixels attribute which represents how far players can see in pixels
 * Previously setting was viewDistanceInChunks, but then if tileSize in certain maps was different, setting had to be changed
 */
export function calculateViewDistanceInChunks(tileSize: number): number {
   const pixelsPerChunk = gameSettings.chunkSize * tileSize;
   return Math.ceil(gameSettings.viewDistancePixels / pixelsPerChunk);
}

/**
 * Calculate unload distance in chunks based on pixel distance and tile size
 */
export function calculateUnloadDistanceInChunks(tileSize: number): number {
   const pixelsPerChunk = gameSettings.chunkSize * tileSize;
   const totalDistance = gameSettings.viewDistancePixels + gameSettings.unloadBufferPixels;
   return Math.ceil(totalDistance / pixelsPerChunk);
}
