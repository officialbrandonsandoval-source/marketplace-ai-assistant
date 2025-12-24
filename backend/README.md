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

## Build + "test" (type-check) automation

This repo treats **TypeScript type-check** as the "test" step for the backend.

- Build + type-check:
	- `npm run build:test`
- Build + type-check, then **auto commit + push** if there are git changes:
	- `npm run build:test:push`

### Optional: local git hooks

If you want git hooks stored in the repo (instead of `.git/hooks`), you can point git at `backend/.githooks`:

```sh
git config core.hooksPath backend/.githooks
```

Hooks are optional and never run in CI unless you explicitly enable them.

## Health check

- `GET /health`
