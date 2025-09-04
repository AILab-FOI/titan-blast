// auth/src/Server.ts
import express, { Express } from 'express';
import cors from 'cors';
import passport from 'passport';
import { config } from './Config';
import { createTables } from './db/DatabaseSetup';
import { configurePassport } from './PassportConfig';
import { authController } from './controllers/AuthController';
import { securityHeaders } from './middleware/SecurityHeadersMiddleware';
import { apiRateLimiter } from './middleware/RateLimitMiddleware';

// Create Express app with all routes configured
export function createApp(): Express {
   // Initialize database
   createTables();

   const app = express();

   // Apply security headers to all responses
   app.use(securityHeaders);

   // Global rate limiting for all routes
   app.use(apiRateLimiter);

   // Configure middleware
   app.use(express.json());
   app.use(
      cors({
         origin: config.clientUrls,
         credentials: true,
      }),
   );

   // Initialize passport with local strategy
   app.use(passport.initialize());
   configurePassport();

   // Register auth routes
   app.use('/auth', authController);

   app.use((err, req, res, next) => {
      console.error('Unhandled error:', err);
      res.status(500).json({
         status: 'error',
         message: 'Internal server error',
      });
   });

   return app;
}

// Only start the server if this file is run directly, not when imported
if (require.main === module) {
   const app = createApp();
   const PORT = config.port;
   app.listen(PORT, () => {
      console.log(`Auth server running on port ${PORT}`);
   });
}
