import request from 'supertest';
import { Express } from 'express';
import path from 'path';
import fs from 'fs';
import * as crypto from 'crypto';

// Import only when server can be properly configured for testing
let app: Express;

// Generate a unique but shorter identifier for test names
const uniqueId = Math.floor(Math.random() * 10000).toString();

// Test user data - ensuring username stays under 20 characters
const TEST_USER = {
   username: `test_${uniqueId}`,
   email: `test_${uniqueId}@example.com`,
   password: 'Password123!',
};

// Store tokens between tests
let authToken: string;
let refreshToken: string;
let guestToken: string;

// Generate test RSA keys for JWT
const generateTestKeys = () => {
   const keysDir = path.join(__dirname, '..', 'keys');

   if (!fs.existsSync(keysDir)) {
      fs.mkdirSync(keysDir, { recursive: true });
   }

   const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
         type: 'spki',
         format: 'pem',
      },
      privateKeyEncoding: {
         type: 'pkcs8',
         format: 'pem',
      },
   });

   fs.writeFileSync(path.join(keysDir, 'private.key'), privateKey);
   fs.writeFileSync(path.join(keysDir, 'public.key'), publicKey);
};

// Clear test database before all tests
beforeAll(async () => {
   const testDbPath = path.join(__dirname, '..', 'data', 'auth.test.db');

   // If test DB exists, delete it to start fresh
   if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
   }

   // Generate test keys
   generateTestKeys();

   // Set environment for test
   process.env.DB_PATH = './data/auth.test.db';
   process.env.JWT_SECRET = 'test-jwt-secret';

   // Now that we've configured the environment, we can import the app
   // This ensures the DB is initialized with our test settings
   const { createApp } = require('../src/Server');
   app = createApp();
});

describe('Authentication API', () => {
   describe('User Registration', () => {
      test('should reject registration with invalid data', async () => {
         const res = await request(app).post('/auth/register').send({
            username: 'u', // too short
            password: 'weak', // doesn't meet requirements
         });

         expect(res.status).toBe(400);
         expect(res.body.message).toBe('Validation failed');
      });

      test('should successfully register a new user', async () => {
         const res = await request(app).post('/auth/register').send(TEST_USER);

         expect(res.status).toBe(201);
         expect(res.body).toHaveProperty('token');
         expect(res.body).toHaveProperty('refreshToken');
         expect(res.body).toHaveProperty('user');
         expect(res.body.user.username).toBe(TEST_USER.username);

         // Save tokens for later tests
         authToken = res.body.token;
         refreshToken = res.body.refreshToken;
      });

      test('should reject duplicate username', async () => {
         const res = await request(app).post('/auth/register').send(TEST_USER);

         expect(res.status).toBe(400);
         expect(res.body.message).toContain('Username already taken');
      });
   });

   describe('User Login', () => {
      test('should reject login with incorrect credentials', async () => {
         const res = await request(app).post('/auth/login').send({
            login: TEST_USER.username,
            password: 'wrongpassword',
         });

         expect(res.status).toBe(401);
      });

      test('should successfully login with username', async () => {
         const res = await request(app).post('/auth/login').send({
            login: TEST_USER.username,
            password: TEST_USER.password,
         });

         expect(res.status).toBe(200);
         expect(res.body).toHaveProperty('token');
         expect(res.body).toHaveProperty('refreshToken');
         expect(res.body.user.username).toBe(TEST_USER.username);

         // Update token
         authToken = res.body.token;
         refreshToken = res.body.refreshToken;
      });

      test('should successfully login with email', async () => {
         const res = await request(app).post('/auth/login').send({
            login: TEST_USER.email,
            password: TEST_USER.password,
         });

         expect(res.status).toBe(200);
         expect(res.body).toHaveProperty('token');
         expect(res.body).toHaveProperty('refreshToken');
      });
   });

   describe('Token Operations', () => {
      test('should reject token refresh without token', async () => {
         const res = await request(app).post('/auth/refresh').send({});
         expect(res.status).toBe(400);
      });

      test('should refresh valid tokens', async () => {
         const res = await request(app).post('/auth/refresh').send({ refreshToken });

         expect(res.status).toBe(200);
         expect(res.body).toHaveProperty('token');
         expect(res.body).toHaveProperty('refreshToken');

         // Update tokens
         authToken = res.body.token;
         refreshToken = res.body.refreshToken;
      });

      test('should provide public key for verification', async () => {
         const res = await request(app).get('/auth/public-key');

         expect(res.status).toBe(200);
         expect(res.body).toHaveProperty('publicKey');
         expect(res.body.publicKey).toContain('-----BEGIN PUBLIC KEY-----');
      });
   });

   describe('Token Verification', () => {
      test('should reject requests without token', async () => {
         const res = await request(app).get('/auth/verify');

         expect(res.status).toBe(401);
      });

      test('should reject invalid tokens', async () => {
         const res = await request(app)
            .get('/auth/verify')
            .set('Authorization', 'Bearer invalid-token');

         expect(res.status).toBe(401);
      });

      test('should verify valid tokens', async () => {
         const res = await request(app)
            .get('/auth/verify')
            .set('Authorization', `Bearer ${authToken}`);

         expect(res.status).toBe(200);
         expect(res.body).toHaveProperty('user');
         expect(res.body.user.username).toBe(TEST_USER.username);
      });
   });

   describe('Guest Login', () => {
      test('should create guest session', async () => {
         const res = await request(app).post('/auth/guest');

         expect(res.status).toBe(200);
         expect(res.body).toHaveProperty('token');
         expect(res.body).toHaveProperty('user');
         expect(res.body.user.isGuest).toBe(true);

         // Save guest token
         guestToken = res.body.token;
      });
   });

   describe('Game Token', () => {
      test('should reject requests without authentication', async () => {
         const res = await request(app).post('/auth/game-token').send({ gameId: 'game123' });

         expect(res.status).toBe(401);
      });

      test('should reject invalid game IDs', async () => {
         const res = await request(app)
            .post('/auth/game-token')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ gameId: '' }); // Empty game ID

         expect(res.status).toBe(400);
         expect(res.body.message).toBe('Validation failed');
      });

      test('should generate game token for authenticated users', async () => {
         const res = await request(app)
            .post('/auth/game-token')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ gameId: 'game123' });

         expect(res.status).toBe(200);
         expect(res.body).toHaveProperty('gameToken');
      });
   });

   describe('Guest Conversion', () => {
      // Generate a short unique ID for the converted user
      const convId = Math.floor(Math.random() * 10000).toString();

      const CONVERTED_USER = {
         username: `conv_${convId}`,
         email: `conv_${convId}@example.com`,
         password: 'ConvertedPass123!',
      };

      test('should reject conversion with invalid data', async () => {
         const res = await request(app).post('/auth/guest/convert').send({
            token: guestToken,
            username: 'ab', // too short
            password: 'weak',
         });

         expect(res.status).toBe(400);
         expect(res.body.message).toBe('Validation failed');
      });

      test('should convert guest to registered user', async () => {
         const res = await request(app)
            .post('/auth/guest/convert')
            .send({
               ...CONVERTED_USER,
               token: guestToken,
            });

         expect(res.status).toBe(200);
         expect(res.body).toHaveProperty('token');
         expect(res.body).toHaveProperty('refreshToken');
         expect(res.body).toHaveProperty('user');
         expect(res.body.user.username).toBe(CONVERTED_USER.username);
      });
   });
});
