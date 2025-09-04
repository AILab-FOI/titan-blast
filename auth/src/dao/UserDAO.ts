// auth/src/dao/UserDAO.ts
import { getDb } from '../db/DatabaseSetup';
import { User } from '../models/User';

export class UserDAO {
   /**
    * Find a user by username
    */
   findByUsername(username: string): User | null {
      const db = getDb();
      const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      return row ? this.mapRowToUser(row) : null;
   }

   /**
    * Find a user by email
    */
   findByEmail(email: string): User | null {
      const db = getDb();
      const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      return row ? this.mapRowToUser(row) : null;
   }

   /**
    * Find a user by ID
    */
   findById(id: number): User | null {
      const db = getDb();
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      return row ? this.mapRowToUser(row) : null;
   }

   /**
    * Create a new user in the database
    */
   createUser(user: Omit<User, 'id'>): User {
      const db = getDb();

      db.prepare('BEGIN TRANSACTION').run();

      try {
         const result = db
            .prepare(
               `
                   INSERT INTO users (username, email, password_hash, display_name, avatar, created_at, last_active)
                   VALUES (?, ?, ?, ?, ?, ?, ?)
               `,
            )
            .run(
               user.username,
               user.email,
               user.passwordHash,
               user.displayName,
               user.avatar,
               user.createdAt,
               user.lastActive,
            );

         const userId = result.lastInsertRowid as number;

         const createdUser = {
            ...user,
            id: userId,
         };

         db.prepare('COMMIT').run();
         return createdUser;
      } catch (error) {
         db.prepare('ROLLBACK').run();
         throw error;
      }
   }

   /**
    * Update user's last active timestamp
    */
   updateLastActive(userId: number, timestamp: number): void {
      const db = getDb();
      db.prepare('UPDATE users SET last_active = ? WHERE id = ?').run(timestamp, userId);
   }

   /**
    * Update user's password hash
    * Used when password hash format needs to be upgraded
    */
   updatePasswordHash(userId: number, newPasswordHash: string): void {
      const db = getDb();

      try {
         db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, userId);
      } catch (error) {
         console.error(`Failed to update password hash for user ${userId}:`, error);
         throw error;
      }
   }

   /**
    * Helper function to map database row to User object
    */
   private mapRowToUser(row: any): User {
      return {
         id: row.id,
         username: row.username,
         email: row.email,
         displayName: row.display_name,
         avatar: row.avatar,
         passwordHash: row.password_hash,
         createdAt: row.created_at,
         lastActive: row.last_active,
      };
   }
}

export const userDAO = new UserDAO();
