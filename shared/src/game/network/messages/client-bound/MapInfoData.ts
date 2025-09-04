// shared/src/game/network/messages/client-bound/MapInfoData.ts

import { MapMetadata } from '../../../map-system/MapTypes';

/**
 * Data sent to client when they join containing map information
 */
export interface MapInfoData {
   metadata: MapMetadata;
   tilesetPath?: string; // Optional path to tileset image
}
