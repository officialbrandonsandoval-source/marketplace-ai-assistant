import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  request.log.error({
    error: error.message,
    stack: error.stack,
    statusCode: error.statusCode,
  });

  const statusCode = error.statusCode || 500;

  reply.code(statusCode).send({
    error: error.name || 'Internal Server Error',
    message: statusCode === 500 ? 'An unexpected error occurred' : error.message,
    statusCode,
    timestamp: new Date().toISOString(),
  });
}
