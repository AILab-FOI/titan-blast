// auth/src/middleware/RateLimitMiddleware.ts
import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
   count: number;
   resetTime: number;
}

const ipLimiter: Map<string, RateLimitRecord> = new Map();

const accountLimiter: Map<string, RateLimitRecord> = new Map();

/**
 * Rate limiting middleware to protect against brute force attacks
 * @param maxAttempts Maximum number of attempts within the time window
 * @param windowMs Time window in milliseconds
 * @param identifierFn Function to extract the identifier (e.g., IP, username)
 * @param limiterMap The Map to use for tracking attempts
 */
export function createRateLimiter(
   maxAttempts: number,
   windowMs: number,
   identifierFn: (req: Request) => string,
   limiterMap: Map<string, RateLimitRecord>,
) {
   return (req: Request, res: Response, next: NextFunction) => {
      // Skip rate limiting in test environment
      if (process.env.NODE_ENV === 'test') {
         return next();
      }

      const identifier = identifierFn(req);
      const now = Date.now();

      // Clean up expired entries every 100 requests
      if (Math.random() < 0.01) {
         for (const [key, record] of limiterMap.entries()) {
            if (now > record.resetTime) {
               limiterMap.delete(key);
            }
         }
      }

      let record = limiterMap.get(identifier);

      if (!record || now > record.resetTime) {
         record = {
            count: 1,
            resetTime: now + windowMs,
         };
         limiterMap.set(identifier, record);
         return next();
      }

      // Increment attempt count
      record.count += 1;

      // Check if limit exceeded
      if (record.count > maxAttempts) {
         const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);

         // Set rate limit headers
         res.set('Retry-After', String(retryAfterSeconds));
         res.set('X-RateLimit-Limit', String(maxAttempts));
         res.set('X-RateLimit-Remaining', '0');
         res.set('X-RateLimit-Reset', String(Math.ceil(record.resetTime / 1000)));

         // Return 429 Too Many Requests
         return res.status(429).json({
            status: 'error',
            message: 'Too many attempts, please try again later',
            retryAfter: retryAfterSeconds,
         });
      }

      // Set rate limit headers for non-blocked requests too
      res.set('X-RateLimit-Limit', String(maxAttempts));
      res.set('X-RateLimit-Remaining', String(maxAttempts - record.count));
      res.set('X-RateLimit-Reset', String(Math.ceil(record.resetTime / 1000)));

      next();
   };
}

import { SecurityConfig } from '../security/SecurityConfig';

// IP-based rate limiter (useful for login, register endpoints)
export const ipRateLimiter = createRateLimiter(
   SecurityConfig.rateLimiting.auth.ipRateLimit.maxAttempts,
   SecurityConfig.rateLimiting.auth.ipRateLimit.windowMs,
   (req) => req.ip || req.socket.remoteAddress || 'unknown', // IP address as identifier
   ipLimiter,
);

// Username/email based rate limiter (for login attempts)
export const accountRateLimiter = createRateLimiter(
   SecurityConfig.rateLimiting.auth.accountRateLimit.maxAttempts,
   SecurityConfig.rateLimiting.auth.accountRateLimit.windowMs,
   (req) => (req.body.login || req.body.username || '').toLowerCase(), // Username/email as identifier
   accountLimiter,
);

// General API rate limiter
export const apiRateLimiter = createRateLimiter(
   SecurityConfig.rateLimiting.api.maxAttempts,
   SecurityConfig.rateLimiting.api.windowMs,
   (req) => req.ip || req.socket.remoteAddress || 'unknown',
   new Map(),
);
