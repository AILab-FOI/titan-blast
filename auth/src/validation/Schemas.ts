// auth/src/validation/schemas.ts
import { z } from 'zod';

// Username validation
export const usernameSchema = z
   .string()
   .min(3, 'Username must be at least 3 characters long')
   .max(20, 'Username cannot exceed 20 characters')
   .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

// Email validation
export const emailSchema = z
   .string()
   .email('Invalid email address')
   .max(255, 'Email cannot exceed 255 characters');

// Password validation
export const passwordSchema = z
   .string()
   .min(8, 'Password must be at least 8 characters long')
   .max(100, 'Password is too long')
   .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()])[A-Za-z\d!@#$%^&*()]{8,}$/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
   );

// Registration validation schema
export const registerSchema = z.object({
   username: usernameSchema,
   email: emailSchema.optional().nullable(),
   password: passwordSchema,
});

// Login validation schema
export const loginSchema = z.object({
   login: z.string().min(1, 'Username or email is required'),
   password: z.string().min(1, 'Password is required'),
});

// Guest conversion schema
export const guestConversionSchema = z.object({
   token: z.string().min(1, 'Guest token is required'),
   username: usernameSchema,
   email: emailSchema.optional().nullable(),
   password: passwordSchema,
});

// Game token schema
export const gameTokenSchema = z.object({
   gameId: z.string().min(1, 'Game ID is required'),
});
