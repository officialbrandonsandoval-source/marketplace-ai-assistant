import { eq } from 'drizzle-orm';
import { db, closeDatabaseConnection } from '../src/db/client.js';
import { accounts } from '../src/db/schema.js';

const [, , accountId, planArg, expiresAtArg] = process.argv;

const validPlans = ['free', 'pro', 'enterprise'] as const;

if (!accountId || !planArg) {
  console.error('Usage: npm run plan:set -- <accountId> <free|pro|enterprise> [expiresAtISO|null]');
  process.exit(1);
}

if (!validPlans.includes(planArg as (typeof validPlans)[number])) {
  console.error(`Invalid plan: ${planArg}. Use one of: ${validPlans.join(', ')}`);
  process.exit(1);
}

const plan = planArg as (typeof validPlans)[number];
let expiresAt: Date | null = null;

if (typeof expiresAtArg === 'string' && expiresAtArg.length > 0) {
  if (expiresAtArg === 'null') {
    expiresAt = null;
  } else {
    const parsed = new Date(expiresAtArg);
    if (Number.isNaN(parsed.getTime())) {
      console.error('Invalid expiresAt. Use ISO format (e.g. 2025-01-31T00:00:00Z) or null.');
      process.exit(1);
    }
    expiresAt = parsed;
  }
}

await db
  .update(accounts)
  .set({
    plan,
    plan_tier: plan,
    plan_expires_at: expiresAt,
    updated_at: new Date(),
  })
  .where(eq(accounts.id, accountId));

console.log(
  JSON.stringify(
    {
      accountId,
      plan,
      planExpiresAt: expiresAt ? expiresAt.toISOString() : null,
    },
    null,
    2
  )
);

await closeDatabaseConnection();
