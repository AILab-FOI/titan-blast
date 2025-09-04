// auth/src/Config.ts
import * as fs from 'node:fs';
import * as path from 'node:path';

// Load RSA keys if they exist, or provide default path
let privateKey: string | undefined;
let publicKey: string | undefined;

try {
   const privateKeyPath =
      process.env.JWT_PRIVATE_KEY_PATH || path.join(__dirname, '../keys/private.key');
   const publicKeyPath =
      process.env.JWT_PUBLIC_KEY_PATH || path.join(__dirname, '../keys/public.key');

   if (fs.existsSync(privateKeyPath)) {
      privateKey = fs.readFileSync(privateKeyPath, 'utf8');
   }

   if (fs.existsSync(publicKeyPath)) {
      publicKey = fs.readFileSync(publicKeyPath, 'utf8');
   }
} catch (err) {
   console.warn('Could not load RSA keys:', err);
}

export const config = {
   // Server
   port: process.env.PORT || 4000,
   clientUrl: process.env.CLIENT_URL || 'http://localhost:9000',
   clientUrls: (process.env.CLIENT_URLS || 'http://localhost:9000,http://localhost:9001').split(
      ',',
   ),

   // Database
   db: {
      path: process.env.DB_PATH || './data/auth.db',
   },

   // JWT
   jwt: {
      privateKey,
      publicKey,
      // Fallback to symmetric key if RSA keys aren't available
      secret: process.env.JWT_SECRET || 'replace-this-with-a-secure-secret-in-production',
      algorithm: privateKey && publicKey ? 'RS256' : 'HS256',
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
      refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
   },
};
