// auth/src/security/SecurityConfig.ts
import { Options } from '@node-rs/argon2';

/**
 * Central configuration for all security-related settings
 */
export const SecurityConfig = {
   /**
    * Password hashing configuration
    */
   passwordHashing: {
      /**
       * Argon2id configuration based on OWASP recommendations
       * https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#argon2id
       */
      argon2: {
         // Memory cost: 19 MiB (19 * 1024 = 19456 KiB)
         memoryCost: 19456,
         // Time cost: 2 iterations
         timeCost: 2,
         // Parallelism: 1 thread
         parallelism: 1,
         // Output hash length: 32 bytes
         outputLen: 32,
         // Using Argon2id variant (combines Argon2i and Argon2d)
         algorithm: 2, // 0 = Argon2d, 1 = Argon2i, 2 = Argon2id
      } as Options,
   },

   /**
    * Authentication token settings
    */
   tokens: {
      expiresIn: {
         auth: '1d', // Authentication token lifetime
         refresh: '7d', // Refresh token lifetime
         guest: '30d', // Guest token lifetime
         game: '1h', // Game session token lifetime
      },

      // Automatically refresh tokens that are near expiration
      refreshBeforeExpiry: '15m',
   },

   /**
    * Rate limiting configuration
    */
   rateLimiting: {
      // General API rate limits
      api: {
         maxAttempts: 60,
         windowMs: 60 * 1000, // 1 minute
      },

      // Authentication endpoint rate limits
      auth: {
         // Login attempt limits by IP address
         ipRateLimit: {
            maxAttempts: 10,
            windowMs: 15 * 60 * 1000, // 15 minutes
         },

         // Login attempt limits by account
         accountRateLimit: {
            maxAttempts: 5,
            windowMs: 60 * 60 * 1000, // 60 minutes
         },
      },
   },

   /**
    * Password policy settings
    */
   passwordPolicy: {
      minLength: 12,
      maxLength: 128,
      requireComplexity: true,
      complexityRequirements: {
         minCategories: 3, // At least 3 of: uppercase, lowercase, numbers, special chars
         preventCommonPasswords: true,
      },
   },

   /**
    * HTTP Security Headers
    */
   securityHeaders: {
      contentSecurityPolicy: {
         directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
         },
      },
      strictTransportSecurity: 'max-age=31536000; includeSubDomains',
      xContentTypeOptions: 'nosniff',
      xFrameOptions: 'DENY',
      xXssProtection: '1; mode=block',
      referrerPolicy: 'strict-origin-when-cross-origin',
   },
};
