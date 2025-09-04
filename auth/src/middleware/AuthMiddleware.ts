// auth/src/middleware/authMiddleware.ts
import { NextFunction, Request, Response } from 'express';
import { JwtPayload } from '../models/User';
import { tokenService } from '../services/TokenService';

export interface AuthenticatedRequest extends Request {
   jwtPayload?: JwtPayload;
}

/**
 * Authentication middleware to verify JWT tokens
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
   try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
         res.status(401).json({ message: 'Authorization header required' });
         return;
      }

      const parts = authHeader.split(' ');

      if (parts.length !== 2 || parts[0] !== 'Bearer') {
         res.status(401).json({ message: 'Authorization header format must be Bearer {token}' });
         return;
      }

      const token = parts[1];

      if (!token) {
         res.status(401).json({ message: 'Token not provided' });
         return;
      }

      const decoded = tokenService.verifyToken<JwtPayload>(token);

      if (!decoded) {
         res.status(401).json({ message: 'Invalid or expired token' });
         return;
      }

      // Explicitly add the payload to the request
      const authReq = req as AuthenticatedRequest;
      authReq.jwtPayload = decoded;

      next();
   } catch (error) {
      console.error('Authentication middleware error:', error);
      res.status(500).json({ message: 'Server error during authentication' });
   }
}
