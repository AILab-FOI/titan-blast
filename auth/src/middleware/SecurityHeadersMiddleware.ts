// auth/src/middleware/SecurityHeadersMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { SecurityConfig } from '../security/SecurityConfig';

/**
 * Middleware to add security headers to all responses
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
   const config = SecurityConfig.securityHeaders;

   // Content Security Policy
   if (config.contentSecurityPolicy) {
      const csp = Object.entries(config.contentSecurityPolicy.directives)
         .map(([key, values]) => {
            const directive = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
            return `${directive} ${values.join(' ')}`;
         })
         .join('; ');

      res.setHeader('Content-Security-Policy', csp);
   }

   // Set other security headers
   if (config.strictTransportSecurity) {
      res.setHeader('Strict-Transport-Security', config.strictTransportSecurity);
   }

   if (config.xContentTypeOptions) {
      res.setHeader('X-Content-Type-Options', config.xContentTypeOptions);
   }

   if (config.xFrameOptions) {
      res.setHeader('X-Frame-Options', config.xFrameOptions);
   }

   if (config.xXssProtection) {
      res.setHeader('X-XSS-Protection', config.xXssProtection);
   }

   if (config.referrerPolicy) {
      res.setHeader('Referrer-Policy', config.referrerPolicy);
   }

   next();
}
