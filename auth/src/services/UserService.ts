// auth/src/services/UserService.ts
import { RegisterUserData, User } from '../models/User';
import { userDAO } from '../dao/UserDAO';
import { passwordHasher } from './PasswordHasher';

export class UserService {
   /**
    * Find a user by username
    */
   findByUsername(username: string): User | null {
      return userDAO.findByUsername(username);
   }

   /**
    * Find a user by email
    */
   findByEmail(email: string): User | null {
      return userDAO.findByEmail(email);
   }

   /**
    * Find a user by ID
    */
   findById(id: number): User | null {
      return userDAO.findById(id);
   }

   /**
    * Register a new user
    */
   async registerUser(data: RegisterUserData): Promise<User> {
      if (this.findByUsername(data.username)) {
         throw new Error('Username already taken');
      }

      if (data.email && this.findByEmail(data.email)) {
         throw new Error('Email already registered');
      }

      const passwordHash = await passwordHasher.hashPassword(data.password);

      const now = Date.now();

      return userDAO.createUser({
         username: data.username.toLowerCase(),
         displayName: data.username,
         email: data.email || null,
         avatar: data.avatar || null,
         passwordHash,
         createdAt: now,
         lastActive: now,
      });
   }

   /**
    * Update user's last active timestamp
    */
   updateLastActive(userId: number): void {
      userDAO.updateLastActive(userId, Date.now());
   }

   /**
    * Authenticate a user with username/email and password
    */
   async authenticate(login: string, password: string): Promise<User | null> {
      const isEmail = login.includes('@');

      const user = isEmail ? this.findByEmail(login) : this.findByUsername(login);

      if (!user) {
         return null;
      }

      const isPasswordValid = await passwordHasher.verifyPassword(user.passwordHash, password);

      if (!isPasswordValid) {
         return null;
      }

      this.updatePasswordIfNeeded(user, password).catch((err) => {
         console.error('Error updating password hash:', err);
      });

      this.updateLastActive(user.id);

      return user;
   }

   async updatePasswordIfNeeded(user: User, plainPassword: string): Promise<void> {
      if (passwordHasher.needsRehash(user.passwordHash)) {
         const newHash = await passwordHasher.hashPassword(plainPassword);

         console.log(`Password hash updated to newer format for user ${user.username}`);
      }
   }
}

export const userService = new UserService();
