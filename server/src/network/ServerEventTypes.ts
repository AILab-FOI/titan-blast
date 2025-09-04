import { EventDataMap, ServerBound } from 'shared/game/network/SocketEvents';

/**
 * Utility type that adds server-specific properties to any event data
 * Now using username as the primary identifier and making playerId optional for backward compatibility
 */
export type WithServerContext<T> = T & {
   username: string;
   // channelId?: string;
};

export type ServerEventDataMap = {
   [K in keyof EventDataMap]: K extends ServerBound ? WithServerContext<EventDataMap[K]> : EventDataMap[K];
};