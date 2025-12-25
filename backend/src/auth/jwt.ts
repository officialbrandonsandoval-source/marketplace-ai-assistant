import jwt, { type SignOptions } from 'jsonwebtoken';

// Load environment variables in development only
if (process.env.NODE_ENV !== 'production') {
  const dotenv = await import('dotenv');
  dotenv.config();
}

const JWT_SECRET = process.env.JWT_SECRET;

// SAFE DEFAULTS (do not throw)
const ACCESS_EXPIRY = (process.env.JWT_ACCESS_EXPIRY ?? '1h') as SignOptions['expiresIn'];
const REFRESH_EXPIRY = (process.env.JWT_REFRESH_EXPIRY ?? '7d') as SignOptions['expiresIn'];

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required but was not found in process.env');
}

if (JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

const JWT_SECRET_STR: string = JWT_SECRET;

interface TokenPayload {
  accountId: string;
  userId: string;
  type: 'access' | 'refresh';
}

export function signAccessToken(accountId: string, userId: string): string {
  return jwt.sign(
    { accountId, userId, type: 'access' } as TokenPayload,
    JWT_SECRET_STR,
    { expiresIn: ACCESS_EXPIRY, algorithm: 'HS256' }
  );
}

export function signRefreshToken(accountId: string, userId: string): string {
  return jwt.sign(
    { accountId, userId, type: 'refresh' } as TokenPayload,
    JWT_SECRET_STR,
    { expiresIn: REFRESH_EXPIRY, algorithm: 'HS256' }
  );
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET_STR, { algorithms: ['HS256'] }) as unknown as TokenPayload;
}
