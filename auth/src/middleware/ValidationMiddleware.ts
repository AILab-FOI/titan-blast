// auth/src/middleware/ValidationMiddleware.ts
import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';

/**
 * Middleware factory for validating request body against a Zod schema
 */
export const validateRequest = (schema: AnyZodObject) => {
   return async (req: Request, res: Response, next: NextFunction) => {
      try {
         // Parse and validate the request body
         req.body = await schema.parseAsync(req.body);
         next();
      } catch (error) {
         // Handle Zod validation errors
         if (error instanceof ZodError) {
            // Format validation errors
            const validationErrors = error.errors.map((err) => ({
               path: err.path.join('.'),
               message: err.message,
            }));

            return res.status(400).json({
               status: 'error',
               message: 'Validation failed',
               errors: validationErrors,
            });
         }

         // Handle other errors
         return res.status(500).json({
            status: 'error',
            message: 'Internal server error during validation',
         });
      }
   };
};
