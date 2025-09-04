// auth/scripts/generateKeys.ts
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script to generate RSA key pairs for JWT signing
 */
function generateRSAKeyPair() {
   // Create keys directory if it doesn't exist
   const keysDir = path.join(__dirname, '..', 'keys');
   if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
   }

   console.log('Generating RSA key pair...');

   // Generate RSA key pair
   const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
         type: 'spki',
         format: 'pem',
      },
      privateKeyEncoding: {
         type: 'pkcs8',
         format: 'pem',
      },
   });

   // Write keys to files
   fs.writeFileSync(path.join(keysDir, 'private.key'), privateKey);
   fs.writeFileSync(path.join(keysDir, 'public.key'), publicKey);

   console.log('RSA key pair generated successfully!');
   console.log(`Keys saved in: ${keysDir}`);
   console.log('private.key - Keep this secure and only available to the auth service');
   console.log('public.key - Distribute this to other services for token verification');
}

// Execute the function
generateRSAKeyPair();
