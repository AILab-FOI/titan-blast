// auth/src/services/TokenService.ts
import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { config } from '../Config';
import { GameTokenPayload, JwtPayload, RefreshTokenPayload, User } from '../models/User';

export class TokenService {
   /**
    * Generate authentication JWT token
    */
   generateAuthToken(user: User): string {
      const payload: JwtPayload = {
         id: user.id,
         username: user.username,
         email: user.email,
      };

      const options: SignOptions = {
         expiresIn: config.jwt.expiresIn as never,
         algorithm: config.jwt.algorithm as jwt.Algorithm,
      };

      // Use private key if available, fall back to symmetric key
      const key = config.jwt.privateKey || config.jwt.secret;

      return jwt.sign(payload, key!, options);
   }

   /**
    * Generate refresh token for extended sessions
    */
   generateRefreshToken(user: User, tokenVersion: number = 0): string {
      const payload: RefreshTokenPayload = {
         id: user.id,
         username: user.username,
         tokenVersion,
      };

      const options: SignOptions = {
         expiresIn: config.jwt.refreshExpiresIn as never,
         algorithm: config.jwt.algorithm as jwt.Algorithm,
      };

      const key = config.jwt.privateKey || config.jwt.secret;

      return jwt.sign(payload, key!, options);
   }

   /**
    * Generate guest JWT token
    */
   generateGuestToken(guestId: string): string {
      const payload: JwtPayload = {
         id: -1, // Negative ID to indicate guest
         username: guestId,
         email: null,
         isGuest: true,
      };

      const options: SignOptions = {
         expiresIn: '30d', // Longer expiry for guests
         algorithm: config.jwt.algorithm as jwt.Algorithm,
      };

      const key = config.jwt.privateKey || config.jwt.secret;

      return jwt.sign(payload, key!, options);
   }

   /**
    * Generate game-specific JWT token
    */
   generateGameToken(payload: Pick<GameTokenPayload, 'userId' | 'username' | 'gameId'>): string {
      const tokenPayload: GameTokenPayload = {
         ...payload,
         purpose: 'game-session',
      };

      const options: SignOptions = {
         expiresIn: '1h',
         algorithm: config.jwt.algorithm as jwt.Algorithm,
      };

      const key = config.jwt.privateKey || config.jwt.secret;

      return jwt.sign(tokenPayload, key!, options);
   }

   /**
    * Verify JWT token
    */
   verifyToken<T = JwtPayload>(token: string): T | null {
      try {
         const options: VerifyOptions = {
            algorithms: [config.jwt.algorithm as jwt.Algorithm],
         };

         // Choose the appropriate key based on algorithm
         const key = config.jwt.algorithm === 'RS256' ? config.jwt.publicKey : config.jwt.secret;

         return jwt.verify(token, key!, options) as T;
      } catch (error) {
         return null;
      }
   }

   /**
    * Get public key for sharing with other services
    */
   getPublicKey(): string | null {
      return config.jwt.publicKey || null;
   }
}

// Export a service instance for easier imports
export const tokenService = new TokenService();
