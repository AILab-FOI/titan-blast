import fs from 'fs';
import path from 'path';
// jest.setup.ts

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
   fs.mkdirSync(dataDir, { recursive: true });
}

process.env.DB_PATH = './data/auth.test.db';
