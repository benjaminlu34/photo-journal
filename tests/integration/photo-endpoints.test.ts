import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index';
import { storage } from '../../server/storage';
import { createTestUser, cleanupTestData } from '../test-utils';

describe('Photo API Endpoints', () => {
  let testUserId: string;
  let authToken: string;

  beforeAll(async () => {
    const testUser = await createTestUser();
    testUserId = testUser.id;
    authToken = testUser.token;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe('POST /api/photos/upload', () => {
    it('should reject upload without authentication', async () => {
      const response = await request(app)
        .post('/api/photos/upload')
        .attach('photo', Buffer.from('fake-image-data'), 'test.jpg');

      expect(response.status).toBe(401);
    });

    it('should reject upload without photo file', async () => {
      const response = await request(app)
        .post('/api/photos/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('journalDate', '2024-01-15');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('No photo uploaded');
    });

    it('should reject upload without journal date', async () => {
      const response = await request(app)
        .post('/api/photos/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('photo', Buffer.from('fake-image-data'), 'test.jpg');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Journal date is required');
    });

    it('should reject upload with invalid date format', async () => {
      const response = await request(app)
        .post('/api/photos/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('journalDate', 'invalid-date')
        .attach('photo', Buffer.from('fake-image-data'), 'test.jpg');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid date format. Use YYYY-MM-DD');
    });
  });

  describe('GET /api/photos/:path/signed-url', () => {
    it('should reject access without authentication', async () => {
      const response = await request(app)
        .get('/api/photos/user123/2024-01-15/test.jpg/signed-url');

      expect(response.status).toBe(401);
    });

    it('should reject access to invalid path format', async () => {
      const response = await request(app)
        .get('/api/photos/invalid-path/signed-url')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid storage path format');
    });

    it('should reject access to other users photos without friendship', async () => {
      const response = await request(app)
        .get('/api/photos/other-user/2024-01-15/test.jpg/signed-url')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Access denied to this photo');
    });
  });

  describe('DELETE /api/photos/:path', () => {
    it('should reject deletion without authentication', async () => {
      const response = await request(app)
        .delete('/api/photos/user123/2024-01-15/test.jpg');

      expect(response.status).toBe(401);
    });

    it('should reject deletion of invalid path format', async () => {
      const response = await request(app)
        .delete('/api/photos/invalid-path')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid storage path format');
    });

    it('should reject deletion of other users photos', async () => {
      const response = await request(app)
        .delete('/api/photos/other-user/2024-01-15/test.jpg')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Access denied. You can only delete your own photos.');
    });
  });
});