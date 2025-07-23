import jwt from 'jsonwebtoken';

export function createTestJWT(userId: string, email: string, username: string): string {
  const payload = {
    sub: userId,
    email: email,
    username: username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
  };
  
  return jwt.sign(payload, process.env.SUPABASE_JWT_SECRET || 'test-secret');
}

export function createTestUserToken(userId: string, email: string, username: string) {
  return `Bearer ${createTestJWT(userId, email, username)}`;
}