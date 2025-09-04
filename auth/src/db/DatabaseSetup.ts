// auth/src/db/setup.ts
import Database from 'better-sqlite3';
import { config } from '../Config';
import * as path from 'node:path';
import * as fs from 'node:fs';

let db: Database.Database;

export function getDb(): Database.Database {
   if (!db) {
      const dbPath = config.db.path;
      const dbDir = path.dirname(dbPath);

      if (!fs.existsSync(dbDir)) {
         fs.mkdirSync(dbDir, { recursive: true });
      }

      db = new Database(config.db.path, {
         verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
      });
      db.pragma('journal_mode = WAL');
   }
   return db;
}

export function createTables(): void {
   const db = getDb();

   // Create users table
   db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar TEXT,
      created_at INTEGER NOT NULL,
      last_active INTEGER NOT NULL
    )
  `);

   // Create indices for performance
   db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
  `);
}
