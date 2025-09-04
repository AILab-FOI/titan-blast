// auth/tests/PasswordHasher.test.ts
import { PasswordHasher } from '../src/services/PasswordHasher';

describe('PasswordHasher', () => {
   const passwordHasher = new PasswordHasher({
      // Test with lower memory cost for faster tests
      memoryCost: 4096,
      timeCost: 1,
      parallelism: 1,
      outputLen: 32,
      algorithm: 2, // Argon2id
   });

   const testPassword = 'TestPassword123!';

   test('should hash a password', async () => {
      const hash = await passwordHasher.hashPassword(testPassword);

      // Check that it's a valid argon2id hash format
      expect(hash).toMatch(/^\$argon2id\$v=\d+\$/);

      // Should be reasonably long
      expect(hash.length).toBeGreaterThan(50);
   });

   test('should verify a correct password', async () => {
      const hash = await passwordHasher.hashPassword(testPassword);
      const result = await passwordHasher.verifyPassword(hash, testPassword);

      expect(result).toBe(true);
   });

   test('should reject an incorrect password', async () => {
      const hash = await passwordHasher.hashPassword(testPassword);
      const result = await passwordHasher.verifyPassword(hash, 'WrongPassword123!');

      expect(result).toBe(false);
   });

   test('should reject an invalid hash format', async () => {
      const result = await passwordHasher.verifyPassword('not-a-valid-hash', testPassword);

      expect(result).toBe(false);
   });

   test('needsRehash should identify non-argon2id hashes', () => {
      const bcryptHash = '$2a$12$xQ5OXgckGGPsEQ911FG4VOCJcBZ6eVZt/AhBk5TtDIbRaKIWxUV9e';
      const argon2iHash = '$argon2i$v=19$m=16,t=2,p=1$MTIzNDU2Nzg$mlxsZNKKSoHKTlxqQRoG4A';
      const argon2idHash = '$argon2id$v=19$m=4096,t=3,p=1$salt$hash';

      expect(passwordHasher.needsRehash(bcryptHash)).toBe(true);
      expect(passwordHasher.needsRehash(argon2iHash)).toBe(true);
      expect(passwordHasher.needsRehash(argon2idHash)).toBe(false);
   });
});
