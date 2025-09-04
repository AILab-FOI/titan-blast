// auth/src/controllers/AuthController.ts
import { NextFunction, Request, Response, Router } from 'express';
import passport from 'passport';
import { userService } from '../services/UserService';
import { tokenService } from '../services/TokenService';
import { authenticate, AuthenticatedRequest } from '../middleware/AuthMiddleware';
import { validateRequest } from '../middleware/ValidationMiddleware';
import { ipRateLimiter, accountRateLimiter } from '../middleware/RateLimitMiddleware';
import {
   gameTokenSchema,
   guestConversionSchema,
   loginSchema,
   registerSchema,
} from '../validation/Schemas';

const router = Router();

// Registration route with rate limiting
router.post(
   '/register',
   ipRateLimiter,
   validateRequest(registerSchema),
   async (req: Request, res: Response) => {
      try {
         const { username, email, password } = req.body;

         // Register new user
         const user = await userService.registerUser({
            username,
            email,
            password,
         });

         // Generate tokens
         const token = tokenService.generateAuthToken(user);
         const refreshToken = tokenService.generateRefreshToken(user);

         return res.status(201).json({
            message: 'Registration successful',
            token,
            refreshToken,
            user: {
               id: user.id,
               username: user.username,
               email: user.email,
               displayName: user.displayName,
            },
         });
      } catch (error: any) {
         return res.status(400).json({ message: error.message });
      }
   },
);

// Login route with rate limiting
router.post(
   '/login',
   ipRateLimiter,
   accountRateLimiter,
   validateRequest(loginSchema),
   (req: Request, res: Response, next: NextFunction) => {
      passport.authenticate('local', { session: false }, (err, user, info) => {
         if (err) {
            return next(err);
         }
         if (!user) {
            return res.status(401).json({ message: info.message || 'Authentication failed' });
         }

         // Generate tokens
         const token = tokenService.generateAuthToken(user);
         const refreshToken = tokenService.generateRefreshToken(user);

         return res.json({
            message: 'Login successful',
            token,
            refreshToken,
            user: {
               id: user.id,
               username: user.username,
               email: user.email,
               displayName: user.displayName,
            },
         });
      })(req, res, next);
   },
);

// Token refresh route
router.post('/refresh', ipRateLimiter, async (req: Request, res: Response) => {
   try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
         return res.status(400).json({ message: 'Refresh token is required' });
      }

      // Verify refresh token
      const decoded = tokenService.verifyToken<{ id: number; username: string }>(refreshToken);

      if (!decoded) {
         return res.status(401).json({ message: 'Invalid or expired refresh token' });
      }

      // Get user from database
      const user = userService.findById(decoded.id);

      if (!user) {
         return res.status(401).json({ message: 'User not found' });
      }

      // Generate new tokens
      const newToken = tokenService.generateAuthToken(user);
      const newRefreshToken = tokenService.generateRefreshToken(user);

      return res.json({
         token: newToken,
         refreshToken: newRefreshToken,
      });
   } catch (error) {
      return res.status(500).json({ message: 'Error refreshing token' });
   }
});

// JWT verification route
router.get('/verify', authenticate, (req: Request, res: Response) => {
   const authReq = req as AuthenticatedRequest;
   return res.json({
      user: {
         id: authReq.jwtPayload!.id,
         username: authReq.jwtPayload!.username,
         email: authReq.jwtPayload!.email,
      },
   });
});

// Public key endpoint for other services
router.get('/public-key', (req: Request, res: Response) => {
   const publicKey = tokenService.getPublicKey();

   if (!publicKey) {
      return res.status(404).json({ message: 'Public key not available' });
   }

   return res.json({ publicKey });
});

// Guest login route
router.post('/guest', ipRateLimiter, (req: Request, res: Response) => {
   try {
      // Generate a unique guest ID
      const guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Generate token for the guest
      const token = tokenService.generateGuestToken(guestId);

      return res.json({
         message: 'Guest login successful',
         token,
         user: {
            id: -1,
            username: guestId,
            isGuest: true,
         },
      });
   } catch (error) {
      return res.status(500).json({ message: 'Error creating guest session' });
   }
});

// Convert guest account to registered account
router.post(
   '/guest/convert',
   ipRateLimiter,
   validateRequest(guestConversionSchema),
   async (req: Request, res: Response) => {
      try {
         const { token, username, email, password } = req.body;

         // Verify the guest token
         const decoded = tokenService.verifyToken(token);
         if (!decoded || !decoded.isGuest) {
            return res.status(400).json({ message: 'This is not a guest account' });
         }

         // Register new user
         const user = await userService.registerUser({
            username,
            email,
            password,
            displayName: req.body.displayName || username,
         });

         // Generate new tokens
         const newToken = tokenService.generateAuthToken(user);
         const refreshToken = tokenService.generateRefreshToken(user);

         return res.json({
            message: 'Guest account converted successfully',
            token: newToken,
            refreshToken,
            user: {
               id: user.id,
               username: user.username,
               email: user.email,
               displayName: user.displayName,
            },
         });
      } catch (error: any) {
         return res.status(400).json({ message: error.message });
      }
   },
);

// Game token endpoint
router.post(
   '/game-token',
   authenticate,
   validateRequest(gameTokenSchema),
   async (req: Request, res: Response) => {
      try {
         const authReq = req as AuthenticatedRequest;
         const { gameId } = req.body;

         // Generate short-lived game token
         const gameToken = tokenService.generateGameToken({
            userId: authReq.jwtPayload!.id,
            username: authReq.jwtPayload!.username,
            gameId,
         });

         // Update last active timestamp
         if (authReq.jwtPayload!.id > 0) {
            // Don't update for guest users
            await userService.updateLastActive(authReq.jwtPayload!.id);
         }

         return res.json({ gameToken });
      } catch (error) {
         console.error(error);
         return res.status(500).json({ message: 'Error generating game token' });
      }
   },
);

export const authController = router;
