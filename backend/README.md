# Marketplace AI Backend

Fastify + TypeScript backend foundation (Postgres via Drizzle + Redis rate limiting).

## Required environment

This server requires a Postgres connection and a Redis connection.

Create a `.env` file in `backend/` (or export variables in your shell) based on `.env.example`.

Minimum required variables:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`

## Run

Development:

- `npm run dev`

Production (after build):

- `npm run build`
- `npm run start`

## Health check

- `GET /health`
