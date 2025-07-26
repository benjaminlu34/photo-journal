import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import {
    enhancedFriendMutationsRateLimit,
    enhancedSearchRateLimit,
    enhancedSharingRateLimit,
    roleChangeAuditMiddleware,
    friendshipInputValidation,
    blockedUserSecurityCheck
} from '../../server/middleware/rateLimit';
import {
    friendMutationsLimiter,
    searchLimiter,
    shareLimiter,
    redisManager
} from '../../server/utils/redis';
import { storage } from '../../server/storage';

// Mock storage functions
vi.mock('../../server/storage', () => ({
    storage: {
        getUserByUsername: vi.fn(),
        getFriendshipById: vi.fn(),
        getFriendship: vi.fn(),
    }
}));

// Mock Redis manager
vi.mock('../../server/utils/redis', async () => {
    const actual = await vi.importActual('../../server/utils/redis');
    return {
        ...actual,
        redisManager: {
            getClient: vi.fn(() => null),
            isAvailable: vi.fn(() => false),
            connect: vi.fn(() => Promise.resolve(false)),
            disconnect: vi.fn(() => Promise.resolve()),
        }
    };
});

describe('Rate Limiting and Security Integration Tests', () => {
    let app: express.Application;
    const mockUser = { id: 'user-123', username: 'testuser' };

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Mock authentication middleware
        app.use((req, _res, next) => {
            (req as any).user = mockUser;
            next();
        });

        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Enhanced Friend Mutations Rate Limiting', () => {
        beforeEach(() => {
            app.post('/test/friend-mutation', enhancedFriendMutationsRateLimit, (_req, res) => {
                res.status(200).json({ message: 'Success' });
            });
        });

        it('should allow requests within the rate limit (50/hour)', async () => {
            // Make 10 requests within the limit
            for (let i = 0; i < 10; i++) {
                const response = await request(app).post('/test/friend-mutation');
                expect(response.status).toBe(200);
                expect(response.headers).toHaveProperty('ratelimit-limit', '50');
                expect(response.headers).toHaveProperty('ratelimit-remaining');
                expect(response.headers).toHaveProperty('ratelimit-reset');
            }
        });

        it('should block requests when rate limit exceeded', async () => {
            // Simulate exceeding the rate limit by making many requests
            const promises = [];
            for (let i = 0; i < 55; i++) {
                promises.push(request(app).post('/test/friend-mutation'));
            }

            const responses = await Promise.all(promises);

            // Some requests should be allowed, some should be blocked
            const allowedResponses = responses.filter(r => r.status === 200);
            const blockedResponses = responses.filter(r => r.status === 429);

            expect(allowedResponses.length).toBeLessThanOrEqual(50);
            expect(blockedResponses.length).toBeGreaterThan(0);

            // Check blocked response format
            if (blockedResponses.length > 0) {
                const blockedResponse = blockedResponses[0];
                expect(blockedResponse.body).toHaveProperty('error', 'RATE_LIMITED');
                expect(blockedResponse.body).toHaveProperty('message');
                expect(blockedResponse.body).toHaveProperty('bucket', 'friend_mut');
                expect(blockedResponse.body).toHaveProperty('retryAfter');
                expect(blockedResponse.headers).toHaveProperty('retry-after');
            }
        });

        it('should skip rate limiting in test environment with skipRateLimit query param', async () => {
            process.env.NODE_ENV = 'test';

            const response = await request(app)
                .post('/test/friend-mutation?skipRateLimit=true');

            expect(response.status).toBe(200);

            delete process.env.NODE_ENV;
        });

        it('should require authentication', async () => {
            const appNoAuth = express();
            appNoAuth.use(express.json());
            appNoAuth.post('/test/friend-mutation', enhancedFriendMutationsRateLimit, (_req, res) => {
                res.status(200).json({ message: 'Success' });
            });

            const response = await request(appNoAuth).post('/test/friend-mutation');
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('message', 'Authentication required');
        });
    });

    describe('Enhanced Search Rate Limiting', () => {
        beforeEach(() => {
            app.get('/test/search', enhancedSearchRateLimit, (_req, res) => {
                res.status(200).json({ message: 'Success' });
            });
        });

        it('should allow requests within the rate limit (20/minute)', async () => {
            // Make 15 requests within the limit
            for (let i = 0; i < 15; i++) {
                const response = await request(app).get('/test/search');
                expect(response.status).toBe(200);
                expect(response.headers).toHaveProperty('ratelimit-limit', '20');
            }
        });

        it('should block requests when rate limit exceeded', async () => {
            // Make 25 requests to exceed the limit
            const promises = [];
            for (let i = 0; i < 25; i++) {
                promises.push(request(app).get('/test/search'));
            }

            const responses = await Promise.all(promises);

            const allowedResponses = responses.filter(r => r.status === 200);
            const blockedResponses = responses.filter(r => r.status === 429);

            expect(allowedResponses.length).toBeLessThanOrEqual(20);
            expect(blockedResponses.length).toBeGreaterThan(0);

            // Check blocked response format
            if (blockedResponses.length > 0) {
                const blockedResponse = blockedResponses[0];
                expect(blockedResponse.body).toHaveProperty('bucket', 'search');
            }
        });
    });

    describe('Enhanced Sharing Rate Limiting', () => {
        beforeEach(() => {
            app.post('/test/sharing', enhancedSharingRateLimit, (_req, res) => {
                res.status(200).json({ message: 'Success' });
            });
        });

        it('should allow requests within the rate limit (30/hour)', async () => {
            // Make 10 requests within the limit
            for (let i = 0; i < 10; i++) {
                const response = await request(app).post('/test/sharing');
                expect(response.status).toBe(200);
                expect(response.headers).toHaveProperty('ratelimit-limit', '30');
            }
        });

        it('should block requests when rate limit exceeded', async () => {
            // Make 35 requests to exceed the limit
            const promises = [];
            for (let i = 0; i < 35; i++) {
                promises.push(request(app).post('/test/sharing'));
            }

            const responses = await Promise.all(promises);

            const allowedResponses = responses.filter(r => r.status === 200);
            const blockedResponses = responses.filter(r => r.status === 429);

            expect(allowedResponses.length).toBeLessThanOrEqual(30);
            expect(blockedResponses.length).toBeGreaterThan(0);

            // Check blocked response format
            if (blockedResponses.length > 0) {
                const blockedResponse = blockedResponses[0];
                expect(blockedResponse.body).toHaveProperty('bucket', 'share');
            }
        });
    });

    describe('Role Change Audit Middleware', () => {
        let consoleSpy: any;

        beforeEach(() => {
            consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

            app.patch('/test/role/:friendshipId', roleChangeAuditMiddleware, (req, res) => {
                res.status(200).json({ message: 'Role updated' });
            });
        });

        afterEach(() => {
            consoleSpy.mockRestore();
        });

        it('should log role change attempts', async () => {
            const friendshipId = '123e4567-e89b-12d3-a456-426614174000';
            const role = 'editor';

            await request(app)
                .patch(`/test/role/${friendshipId}`)
                .send({ role });

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(`[AUDIT] Role change attempt - User: ${mockUser.id}, Friendship: ${friendshipId}, New Role: ${role}`)
            );
        });

        it('should log successful role changes', async () => {
            const friendshipId = '123e4567-e89b-12d3-a456-426614174000';
            const role = 'contributor';

            const response = await request(app)
                .patch(`/test/role/${friendshipId}`)
                .send({ role });

            expect(response.status).toBe(200);
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(`[AUDIT] Role change successful - User: ${mockUser.id}, Friendship: ${friendshipId}, New Role: ${role}`)
            );
        });

        it('should require authentication', async () => {
            const appNoAuth = express();
            appNoAuth.use(express.json());
            appNoAuth.patch('/test/role/:friendshipId', roleChangeAuditMiddleware, (_req, res) => {
                res.status(200).json({ message: 'Success' });
            });

            const response = await request(appNoAuth)
                .patch('/test/role/123e4567-e89b-12d3-a456-426614174000')
                .send({ role: 'editor' });

            expect(response.status).toBe(401);
        });
    });

    describe('Friendship Input Validation', () => {
        beforeEach(() => {
            app.post('/test/validate/:username', friendshipInputValidation, (_req, res) => {
                res.status(200).json({ message: 'Valid input' });
            });

            app.patch('/test/validate/:friendshipId', friendshipInputValidation, (_req, res) => {
                res.status(200).json({ message: 'Valid input' });
            });
        });

        it('should validate username format', async () => {
            // Valid username
            const validResponse = await request(app).post('/test/validate/validuser123');
            expect(validResponse.status).toBe(200);

            // Invalid username with special characters
            const invalidResponse = await request(app).post('/test/validate/invalid@user');
            expect(invalidResponse.status).toBe(400);
            expect(invalidResponse.body).toHaveProperty('error', 'INVALID_INPUT');
            expect(invalidResponse.body.message).toContain('invalid characters');
        });

        it('should validate username length', async () => {
            // Too short
            const shortResponse = await request(app).post('/test/validate/ab');
            expect(shortResponse.status).toBe(400);
            expect(shortResponse.body.message).toContain('between 3 and 30 characters');

            // Too long
            const longUsername = 'a'.repeat(31);
            const longResponse = await request(app).post('/test/validate/' + longUsername);
            expect(longResponse.status).toBe(400);
            expect(longResponse.body.message).toContain('between 3 and 30 characters');
        });

        it('should validate role values', async () => {
            // Valid role
            const validResponse = await request(app)
                .patch('/test/validate/123e4567-e89b-12d3-a456-426614174000')
                .send({ role: 'editor' });
            expect(validResponse.status).toBe(200);

            // Invalid role
            const invalidResponse = await request(app)
                .patch('/test/validate/123e4567-e89b-12d3-a456-426614174000')
                .send({ role: 'admin' });
            expect(invalidResponse.status).toBe(400);
            expect(invalidResponse.body.message).toContain('Invalid role');
        });

        it('should validate status values', async () => {
            // Valid status
            const validResponse = await request(app)
                .patch('/test/validate/123e4567-e89b-12d3-a456-426614174000')
                .send({ status: 'accepted' });
            expect(validResponse.status).toBe(200);

            // Invalid status
            const invalidResponse = await request(app)
                .patch('/test/validate/123e4567-e89b-12d3-a456-426614174000')
                .send({ status: 'invalid' });
            expect(invalidResponse.status).toBe(400);
            expect(invalidResponse.body.message).toContain('Invalid status');
        });

        it('should validate UUID format', async () => {
            // Valid UUID
            const validResponse = await request(app)
                .patch('/test/validate/123e4567-e89b-12d3-a456-426614174000')
                .send({ role: 'viewer' });
            expect(validResponse.status).toBe(200);

            // Invalid UUID
            const invalidResponse = await request(app)
                .patch('/test/validate/invalid-uuid')
                .send({ role: 'viewer' });
            expect(invalidResponse.status).toBe(400);
            expect(invalidResponse.body.message).toContain('Invalid friendship ID format');
        });
    });

    describe('Blocked User Security Check', () => {
        beforeEach(() => {
            app.get('/test/security/:username', blockedUserSecurityCheck, (_req, res) => {
                res.status(200).json({ message: 'Access allowed' });
            });

            app.get('/test/security/friendship/:friendshipId', blockedUserSecurityCheck, (_req, res) => {
                res.status(200).json({ message: 'Access allowed' });
            });
        });

        it('should allow access when users are not blocked', async () => {
            const mockTargetUser = { id: 'target-user', username: 'targetuser' };
            const mockFriendship = { status: 'accepted' };

            vi.mocked(storage.getUserByUsername).mockResolvedValue(mockTargetUser);
            vi.mocked(storage.getFriendship).mockResolvedValue(mockFriendship as any);

            const response = await request(app).get('/test/security/targetuser');
            expect(response.status).toBe(200);
        });

        it('should block access when users are blocked', async () => {
            const mockTargetUser = { id: 'target-user', username: 'targetuser' };
            const mockFriendship = { status: 'blocked' };

            vi.mocked(storage.getUserByUsername).mockResolvedValue(mockTargetUser);
            vi.mocked(storage.getFriendship).mockResolvedValue(mockFriendship as any);

            const response = await request(app).get('/test/security/targetuser');
            expect(response.status).toBe(404);
            expect(response.body.message).toBe('User not found');
        });

        it('should handle friendship ID parameter', async () => {
            const mockFriendship = {
                id: 'friendship-123',
                userId: 'other-user',
                friendId: mockUser.id,
                status: 'accepted'
            };

            vi.mocked(storage.getFriendshipById).mockResolvedValue(mockFriendship as any);
            vi.mocked(storage.getFriendship).mockResolvedValue({ status: 'accepted' } as any);

            const response = await request(app).get('/test/security/friendship/friendship-123');
            expect(response.status).toBe(200);
        });

        it('should require authentication', async () => {
            const appNoAuth = express();
            appNoAuth.use(express.json());
            appNoAuth.get('/test/security/:username', blockedUserSecurityCheck, (_req, res) => {
                res.status(200).json({ message: 'Success' });
            });

            const response = await request(appNoAuth).get('/test/security/testuser');
            expect(response.status).toBe(401);
        });

        it('should handle errors gracefully', async () => {
            vi.mocked(storage.getUserByUsername).mockRejectedValue(new Error('Database error'));

            const response = await request(app).get('/test/security/testuser');
            // Should continue to next middleware on error
            expect(response.status).toBe(200);
        });
    });

    describe('RFC 6585 Compliance', () => {
        beforeEach(() => {
            app.post('/test/rfc-compliance', enhancedFriendMutationsRateLimit, (_req, res) => {
                res.status(200).json({ message: 'Success' });
            });
        });

        it('should include RFC 6585 compliant headers', async () => {
            const response = await request(app).post('/test/rfc-compliance');

            expect(response.headers).toHaveProperty('ratelimit-limit');
            expect(response.headers).toHaveProperty('ratelimit-remaining');
            expect(response.headers).toHaveProperty('ratelimit-reset');
        });

        it('should include Retry-After header when rate limited', async () => {
            // Make many requests to trigger rate limiting
            const promises = [];
            for (let i = 0; i < 55; i++) {
                promises.push(request(app).post('/test/rfc-compliance'));
            }

            const responses = await Promise.all(promises);
            const blockedResponse = responses.find(r => r.status === 429);

            if (blockedResponse) {
                expect(blockedResponse.headers).toHaveProperty('retry-after');
                expect(blockedResponse.body).toHaveProperty('retryAfter');
            }
        });
    });
});
