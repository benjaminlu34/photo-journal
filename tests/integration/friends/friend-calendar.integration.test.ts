import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../../../server/routes';
import { storage } from '../../../server/storage';
import { setupTestDB, teardownTestDB } from '../../test-utils';

// Mock authentication middleware to derive user from Bearer token
vi.mock('../../../server/middleware/auth', () => ({
  isAuthenticatedSupabase: (req: any, _res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      req.user = {
        id: token,
        email: `${token}@example.com`,
        username: token.slice(0, 20),
      };
    } else {
      req.user = { id: 'test-user', email: 'test@example.com', username: 'testuser' };
    }
    next();
  }
}));

// Mock rate limiters used by routes
vi.mock('../../../server/middleware/rateLimit', () => ({
  friendRequestRateLimit: (_req: any, _res: any, next: any) => next(),
  friendManagementRateLimit: (_req: any, _res: any, next: any) => next(),
  sharingRateLimit: (_req: any, _res: any, next: any) => next(),
  usernameCheckRateLimit: (_req: any, _res: any, next: any) => next(),
  userSearchRateLimit: (_req: any, _res: any, next: any) => next(),
  usernameChangeRateLimit: (_req: any, _res: any, next: any) => next(),
  enhancedFriendMutationsRateLimit: (_req: any, _res: any, next: any) => next(),
  enhancedSearchRateLimit: (_req: any, _res: any, next: any) => next(),
  enhancedSharingRateLimit: (_req: any, _res: any, next: any) => next(),
  roleChangeAuditMiddleware: (_req: any, _res: any, next: any) => next(),
  friendshipInputValidation: (_req: any, _res: any, next: any) => next(),
  blockedUserSecurityCheck: (_req: any, _res: any, next: any) => next(),
}));

describe('Friend Calendar Endpoints', () => {
  let app: express.Express;
  let server: any;

  const ts = Date.now().toString().slice(-5);
  const userA = { id: `fa${ts}`, email: `fa${ts}@example.com`, username: `fa${ts}`.slice(0, 20), firstName: 'A', lastName: 'One' };
  const userB = { id: `fb${ts}`, email: `fb${ts}@example.com`, username: `fb${ts}`.slice(0, 20), firstName: 'B', lastName: 'Two' };
  const userC = { id: `fc${ts}`, email: `fc${ts}@example.com`, username: `fc${ts}`.slice(0, 20), firstName: 'C', lastName: 'Three' };

  beforeAll(async () => {
    await setupTestDB();
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);

    await storage.upsertUser(userA);
    await storage.upsertUser(userB);
    await storage.upsertUser(userC);

    // Create accepted friendship between A and B (A initiates, B accepts)
    const friendshipAB = await storage.createFriendshipWithCanonicalOrdering(userA.id, userB.id, userA.id);
    await storage.updateFriendshipStatusWithAudit(friendshipAB.id, 'accepted', userB.id);
    // Roles default to 'viewer' in creation; ensure explicit viewer for determinism
    await storage.updateFriendshipRole(friendshipAB.id, userA.id, 'viewer'); // A grants role to B
    await storage.updateFriendshipRole(friendshipAB.id, userB.id, 'viewer'); // B grants role to A
  });

  afterAll(async () => {
    await teardownTestDB();
    if (server) server.close();
  });

  it('GET /api/friends/:friendId/calendar-access returns owner for self', async () => {
    const res = await request(app)
      .get(`/api/friends/${userA.id}/calendar-access`)
      .set('Authorization', `Bearer ${userA.id}`);

    expect(res.status).toBe(200);
    expect(res.body.hasAccess).toBe(true);
    expect(res.body.permission).toBe('owner');
  });

  it('GET /api/friends/:friendId/calendar-access returns viewer+ for accepted friendship', async () => {
    // userB checking access to userA's calendar
    const res = await request(app)
      .get(`/api/friends/${userA.id}/calendar-access`)
      .set('Authorization', `Bearer ${userB.id}`);

    expect(res.status).toBe(200);
    expect(res.body.hasAccess).toBe(true);
    // permission should be one of the allowed values; default viewer
    expect(['viewer', 'contributor', 'editor', 'owner']).toContain(res.body.permission);
  });

  it('POST /api/friends/:friendId/calendar/events enforces date validation', async () => {
    const res = await request(app)
      .post(`/api/friends/${userA.id}/calendar/events`)
      .set('Authorization', `Bearer ${userB.id}`)
      .send({ startDate: 'invalid', endDate: 'also-bad' });

    expect([400, 422]).toContain(res.status);
  });

  it('POST /api/friends/:friendId/calendar/events returns empty array shape behind mock flag', async () => {
    const start = new Date().toISOString();
    const end = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const res = await request(app)
      .post(`/api/friends/${userA.id}/calendar/events`)
      .set('Authorization', `Bearer ${userB.id}`)
      .send({ startDate: start, endDate: end });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.events)).toBe(true);
    expect(res.body.events.length).toBe(0);
  });

  it('GET /api/friends/with-calendar-access lists accepted friends with viewer+ role', async () => {
    const res = await request(app)
      .get(`/api/friends/with-calendar-access`)
      .set('Authorization', `Bearer ${userA.id}`);

    expect(res.status).toBe(200);
    const list = res.body as Array<{ id: string; username?: string | null }>;
    // Should include userB
    expect(list.find(f => f.id === userB.id)).toBeTruthy();
    // Should not include unrelated userC
    expect(list.find(f => f.id === userC.id)).toBeFalsy();
  });
});