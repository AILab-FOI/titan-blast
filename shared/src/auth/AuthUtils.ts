// shared/src/auth/AuthUtils.ts
import jwt, { JwtPayload } from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { User } from './AuthModels';

let cachedPublicKey: string | null = null;

/**
 * Loads the public key used for JWT verification
 * The key can be stored in a file, environment variable, or fetched from auth service
 * @param authServiceUrl Optional URL to fetch the key from if not found elsewhere
 */
export async function getPublicKey(authServiceUrl?: string): Promise<string> {
   // Return cached key if available
   if (cachedPublicKey) {
      return cachedPublicKey;
   }

   // First try to get from environment variable
   if (process.env.JWT_PUBLIC_KEY) {
      cachedPublicKey = process.env.JWT_PUBLIC_KEY;
      return cachedPublicKey;
   }

   // Then try to load from file
   const keyPath = process.env.JWT_PUBLIC_KEY_PATH || path.join(process.cwd(), 'keys', 'public.key');

   try {
      if (fs.existsSync(keyPath)) {
         cachedPublicKey = fs.readFileSync(keyPath, 'utf8');
         return cachedPublicKey;
      }
   } catch (err) {
      console.warn(`Could not load JWT public key from ${keyPath}:`, err);
   }

   // Fallback to shared secret for development environments
   if (process.env.JWT_SECRET) {
      cachedPublicKey = process.env.JWT_SECRET;
      return cachedPublicKey;
   }

   // If auth service URL is provided, try to fetch the key
   if (authServiceUrl) {
      try {
         console.log(`No public key found locally, fetching from auth service at ${authServiceUrl}`);
         cachedPublicKey = await fetchPublicKey(authServiceUrl);
         return cachedPublicKey;
      } catch (err) {
         console.error(`Failed to fetch public key from auth service:`, err);
      }
   }

   throw new Error('No JWT public key or secret available for verification');
}

/**
 * Fetch the public key from auth service
 * This can be used during service startup to ensure the key is available
 */
export async function fetchPublicKey(authServiceUrl: string): Promise<string> {
   try {
      const response = await fetch(`${authServiceUrl}/auth/public-key`);

      if (!response.ok) {
         throw new Error(`Failed to fetch public key: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.publicKey) {
         throw new Error('Public key not found in response');
      }

      // Cache the fetched key
      cachedPublicKey = data.publicKey;

      if (process.env.SAVE_PUBLIC_KEY === 'true') {
         const keyPath = process.env.JWT_PUBLIC_KEY_PATH || path.join(process.cwd(), 'keys', 'public.key');
         const keyDir = path.dirname(keyPath);

         if (!fs.existsSync(keyDir)) {
            fs.mkdirSync(keyDir, { recursive: true });
         }

         fs.writeFileSync(keyPath, data.publicKey);
      }

      return data.publicKey;
   } catch (error) {
      console.error('Error fetching public key:', error);
      throw error;
   }
}

/**
 * Verify a JWT token and extract user data
 * @param token - The JWT token to verify
 * @param authServiceUrl - Optional URL to fetch the key from if not found locally
 * @returns User data from the token, or null if invalid
 */
export async function verifyToken(token: string, authServiceUrl?: string): Promise<User | null> {
   try {
      // Get key for verification
      const key = await getPublicKey(authServiceUrl);
      const algorithm = key.includes('-----BEGIN PUBLIC KEY-----') ? 'RS256' : 'HS256';

      // Verify the token
      const decoded = jwt.verify(token, key, {
         algorithms: [algorithm],
      }) as JwtPayload;

      // Extract user data
      if (!decoded || typeof decoded !== 'object' || !decoded.id || !decoded.username) {
         return null;
      }

      return {
         id: decoded.id.toString(),
         username: decoded.username,
         email: decoded.email || null,
         isGuest: decoded.isGuest || false,
         displayName: decoded.displayName,
      };
   } catch (error) {
      console.error('Token verification failed:', error);
      return null;
   }
}