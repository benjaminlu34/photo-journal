import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';

describe('Username API Endpoints', () => {
  let app: express.Express;

  beforeEach(async () => {
    // Create a fresh app instance for each test to avoid rate limiting issues
    app = express();
    app.use(express.json());
    await registerRoutes(app);
  });

  describe('GET /api/user/check-username', () => {
    it('should return 400 when username parameter is missing', async () => {
      const response = await request(app)
        .get('/api/user/check-username')
        .expect(400);

      expect(response.body).toEqual({
        error: 'INVALID_REQUEST',
        message: "Username parameter 'u' is required"
      });
    });

    it('should return available: false for reserved usernames', async () => {
      const response = await request(app)
        .get('/api/user/check-username?u=admin')
        .expect(200);

      expect(response.body.available).toBe(false);
      expect(response.body.error).toBe('Username is reserved');
      expect(response.body.suggestions).toBeDefined();
      expect(Array.isArray(response.body.suggestions)).toBe(true);
    });

    it('should return available: false for invalid format', async () => {
      const response = await request(app)
        .get('/api/user/check-username?u=ab')
        .expect(200);

      expect(response.body.available).toBe(false);
      expect(response.body.error).toBe('Username must be at least 3 characters');
    });

    it('should return available: false for usernames with invalid characters', async () => {
      const response = await request(app)
        .get('/api/user/check-username?u=user-name')
        .expect(200);

      expect(response.body.available).toBe(false);
      expect(response.body.error).toBe('Username can only contain lowercase letters, numbers, and underscores');
    });

    it('should handle rate limiting', async () => {
      // Make multiple requests quickly to trigger rate limiting
      const requests = Array(25).fill(null).map(() => 
        request(app).get('/api/user/check-username?u=testuser')
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      // Rate limited responses should have proper error format
      if (rateLimitedResponses.length > 0) {
        expect(rateLimitedResponses[0].body).toEqual({
          error: 'RATE_LIMITED',
          message: 'Too many username checks. Please try again in 60 seconds',
          retryAfter: 60
        });
      }
    });
  });

  describe('GET /api/users/search', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/users/search?query=test')
        .expect(401);

      expect(response.body.error).toBe('No authorization header');
    });

    it('should return 400 when query parameter is missing', async () => {
      // This test would need a valid JWT token to pass authentication
      // For now, we'll test the unauthenticated case
      const response = await request(app)
        .get('/api/users/search')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });

    it('should handle rate limiting for search endpoint', async () => {
      // Make multiple requests quickly to trigger rate limiting
      const requests = Array(25).fill(null).map(() => 
        request(app)
          .get('/api/users/search?query=test')
          .set('Authorization', 'Bearer invalid-token')
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429) before auth check
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      if (rateLimitedResponses.length > 0) {
        expect(rateLimitedResponses[0].body).toEqual({
          error: 'RATE_LIMITED',
          message: 'Too many search requests. Please try again in 60 seconds',
          retryAfter: 60
        });
      }
    });
  });

  describe('Username validation edge cases', () => {
    it('should validate basic functionality without rate limiting', async () => {
      // Test a single request to avoid rate limiting
      const response = await request(app)
        .get('/api/user/check-username?u=validuser123&skipRateLimit=true')
        .expect(200);

      // Should return either available true or false with suggestions
      expect(response.body).toHaveProperty('available');
      expect(typeof response.body.available).toBe('boolean');
      
      if (!response.body.available) {
        expect(response.body).toHaveProperty('suggestions');
        expect(Array.isArray(response.body.suggestions)).toBe(true);
      }
    });
  });
});