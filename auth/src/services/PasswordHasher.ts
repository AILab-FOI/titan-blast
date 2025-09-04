// auth/src/services/PasswordHasher.ts
import { hash, verify, Options } from '@node-rs/argon2';
import { SecurityConfig } from '../security/SecurityConfig';

/**
 * PasswordHasher class provides a unified interface for securely hashing and verifying passwords
 * using the Argon2 algorithm.
 */
export class PasswordHasher {
   private options: Options;

   /**
    * Creates a new PasswordHasher instance with the specified options
    * @param options - Argon2 configuration options. Defaults to SecurityConfig settings.
    */
   constructor(options: Options = SecurityConfig.passwordHashing.argon2) {
      this.options = options;
   }

   /**
    * Hash a password using Argon2
    * @param password - The plaintext password to hash
    * @returns Promise<string> - A promise that resolves to the hashed password
    */
   public async hashPassword(password: string): Promise<string> {
      try {
         return await hash(password, this.options);
      } catch (error) {
         console.error('Error hashing password:', error);
         throw new Error('Failed to hash password');
      }
   }

   /**
    * Verify a password against a hash
    * @param hashedPassword - The previously hashed password
    * @param plainPassword - The plaintext password to verify
    * @returns Promise<boolean> - A promise that resolves to true if the password matches
    */
   public async verifyPassword(hashedPassword: string, plainPassword: string): Promise<boolean> {
      try {
         return await verify(hashedPassword, plainPassword);
      } catch (error) {
         // Only log detailed errors in development, not in tests
         if (process.env.NODE_ENV !== 'test') {
            console.error('Error verifying password:', error);
         }
         // Return false on error rather than throwing to avoid revealing info in authentication flow
         return false;
      }
   }

   /**
    * Check if a password hash needs to be rehashed (based on updated security parameters)
    * @param hashedPassword - The previously hashed password to check
    * @returns boolean - True if the password should be rehashed
    */
   public needsRehash(hashedPassword: string): boolean {

      if (!hashedPassword.startsWith('$argon2id$')) {
         return true;
      }

      return false;
   }
}

export const passwordHasher = new PasswordHasher();
