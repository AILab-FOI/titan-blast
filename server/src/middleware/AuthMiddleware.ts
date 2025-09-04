// server/src/middleware/GeckosAuthMiddleware.ts
import { verifyToken } from 'shared/auth/AuthUtils';
import http from 'http';
import { PlayerData } from 'shared/game/PlayerData';

// Store auth service URL for token verification
let authServiceUrl: string;

/**
 * Initialize the auth middleware with the auth service URL
 * @param url URL of the auth service
 */
export function initAuthMiddleware(url: string): void {
   authServiceUrl = url;
   console.log(`Auth middleware initialized with auth service URL: ${url}`);
}

/**
 * Authentication middleware for Geckos.io
 * This function will be passed to the geckos server as the authorization option
 *
 * @param auth JWT token from client
 * @param request HTTP request
 * @param response HTTP response
 * @returns User data if authenticated, false otherwise
 */
export async function geckosAuthMiddleware(
   auth: string | undefined,
   request: http.IncomingMessage,
   response: http.OutgoingMessage,
): Promise<PlayerData | boolean> {
   // If no token provided, reject the connection
   if (!auth) {
      console.log('Auth middleware: No token provided');
      return false;
   }

   try {
      // Verify the token using AuthUtils
      console.log('auth', auth);
      const userData = await verifyToken(auth, authServiceUrl);
      console.log(userData);

      if (!userData) {
         console.log('Auth middleware: Invalid token');
         return false;
      }

      console.log(`Auth middleware: Authenticated user ${userData.username} (ID: ${userData.id})`);

      // Return user data to associate with the channel
      return new PlayerData(userData.id, userData.username, userData.displayName || userData.username);
   } catch (error) {
      console.error('Auth middleware error:', error);
      return false;
   }
}
