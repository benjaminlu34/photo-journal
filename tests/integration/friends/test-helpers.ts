// Test helper to create a properly configured test app
import express from 'express';
import { registerRoutes } from '../../../server/routes';
import { storage } from '../../../server/storage';
import { db } from '../../../server/db';
import { users, friendships } from '../../../shared/schema/schema';

// Create test app with bypassed authentication
export const createTestAppWithMockAuth = async () => {
  const app = express();
  app.use(express.json());
  
  // Mock the authentication middleware to always allow requests
  // We need to override the actual auth middleware
  const originalAuth = require('../../../server/middleware/auth');
  const mockAuth = {
    isAuthenticatedSupabase: (req: any, _res: any, next: any) => {
      // Use a simple user ID from the Authorization header
      const authHeader = req.headers.authorization;
      const userId = authHeader?.startsWith('Bearer ') 
        ? authHeader.substring(7) 
        : 'test-user';
      
      req.user = {
        id: userId,
        email: `${userId}@example.com`,
        username: userId.length > 20 ? userId.substring(0, 20) : userId
      };
      next();
    }
  };
  
  // Override the auth module
  jest.doMock('../../../server/middleware/auth', () => mockAuth);
  
  const server = await registerRoutes(app);
  return { app, server };
};

// Helper to create unique test users
export const createUniqueTestUsers = async (count: number = 4) => {
  const timestamp = Date.now().toString().slice(-4);
  const users = [];
  
  for (let i = 1; i <= count; i++) {
    const userId = `u${i}${timestamp}`;
    const user = await storage.upsertUser({
      id: userId,
      email: `user${i}@${timestamp}.com`,
      username: `user${i}${timestamp}`.slice(0, 20),
      firstName: 'Test',
      lastName: `User${i}`,
    });
    users.push(user);
  }
  
  return users;
};

// Helper to clean up test data
export const cleanupTestData = async () => {
  await db.delete(friendships);
  await db.delete(users);
};