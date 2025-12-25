import type { FastifyInstance } from 'fastify';
import jwtPlugin from '@fastify/jwt';
import * as dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY;
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

if (JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

if (!ACCESS_EXPIRY) {
  throw new Error('JWT_ACCESS_EXPIRY environment variable is required');
}

if (!REFRESH_EXPIRY) {
  throw new Error('JWT_REFRESH_EXPIRY environment variable is required');
}

const JWT_SECRET_STR: string = JWT_SECRET;

export interface TokenPayload {
  accountId: string;
  userId: string;
  type: 'access' | 'refresh';
}

export async function registerJwt(fastify: FastifyInstance): Promise<void> {
  await fastify.register(jwtPlugin, {
    secret: JWT_SECRET_STR,
    sign: { algorithm: 'HS256' },
  });
}

export function signAccessToken(fastify: FastifyInstance, accountId: string, userId: string): string {
  return fastify.jwt.sign({ accountId, userId, type: 'access' } satisfies TokenPayload, {
    expiresIn: ACCESS_EXPIRY,
  });
}

export function signRefreshToken(fastify: FastifyInstance, accountId: string, userId: string): string {
  return fastify.jwt.sign({ accountId, userId, type: 'refresh' } satisfies TokenPayload, {
    expiresIn: REFRESH_EXPIRY,
  });
}

export function verifyToken(fastify: FastifyInstance, token: string): TokenPayload {
  return fastify.jwt.verify<TokenPayload>(token, {
    algorithms: ['HS256'],
  });
}
