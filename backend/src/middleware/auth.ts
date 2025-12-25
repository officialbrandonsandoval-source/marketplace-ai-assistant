import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken } from '../auth/jwt.js';

type AuthedRequest = FastifyRequest & {
  accountId?: string;
  userId?: string;
};

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return void reply.code(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      });
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (payload.type !== 'access') {
      return void reply.code(401).send({
        error: 'Unauthorized',
        message: 'Invalid token type',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      });
    }

    (request as AuthedRequest).accountId = payload.accountId;
    (request as AuthedRequest).userId = payload.userId;
  } catch {
    return void reply.code(401).send({
      error: 'Unauthorized',
      message: 'Token verification failed',
      statusCode: 401,
      timestamp: new Date().toISOString(),
    });
  }
}
