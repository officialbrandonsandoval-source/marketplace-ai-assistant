import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { users, accounts, actions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { signAccessToken, signRefreshToken, verifyToken } from '../auth/jwt.js';

const LoginSchema = z.object({
  deviceFingerprint: z.string().min(10),
  email: z.string().email().optional(),
});

const RefreshSchema = z.object({
  refreshToken: z.string(),
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = LoginSchema.parse(request.body);

      // Find user by device fingerprint
      let [user] = await db
        .select()
        .from(users)
        .where(eq(users.device_fingerprint, body.deviceFingerprint))
        .limit(1);

      if (!user) {
        // Create new account
        const [newAccount] = await db
          .insert(accounts)
          .values({})
          .returning();

        // Create new user
        [user] = await db
          .insert(users)
          .values({
            account_id: newAccount.id,
            device_fingerprint: body.deviceFingerprint,
            email: body.email ?? null,
          })
          .returning();

        request.log.info({ userId: user.id, accountId: newAccount.id }, 'New user created');
      }

      // Update last seen
      await db
        .update(users)
        .set({ last_seen_at: new Date() })
        .where(eq(users.id, user.id));

      // Generate tokens
  const accessToken = signAccessToken(fastify, user.account_id, user.id);
  const refreshToken = signRefreshToken(fastify, user.account_id, user.id);

      // Log action
      await db.insert(actions).values({
        account_id: user.account_id,
        user_id: user.id,
        action_type: 'login',
        metadata: { device_fingerprint: body.deviceFingerprint },
        ip_address: request.ip,
        user_agent: request.headers['user-agent'] ?? null,
      });

      return reply.send({
        accessToken,
        refreshToken,
        accountId: user.account_id,
        userId: user.id,
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          message: error.issues[0]?.message ?? 'Invalid request',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }
      throw error;
    }
  });

  fastify.post('/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = RefreshSchema.parse(request.body);

  const payload = verifyToken(fastify, body.refreshToken);

      if (payload.type !== 'refresh') {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid token type',
          statusCode: 401,
          timestamp: new Date().toISOString(),
        });
      }

  const accessToken = signAccessToken(fastify, payload.accountId, payload.userId);

      return reply.send({ accessToken });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          error: 'Validation error',
          message: error.issues[0]?.message ?? 'Invalid request',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      return reply.code(401).send({
        error: 'Unauthorized',
        message: 'Token verification failed',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      });
    }
  });
}
