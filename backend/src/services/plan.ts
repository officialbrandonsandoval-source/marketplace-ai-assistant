import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { accounts } from '../db/schema.js';

export type PlanTier = 'free' | 'pro' | 'enterprise';

export interface AccountPlan {
  plan: PlanTier;
  isActive: boolean;
}

export async function getAccountPlan(accountId: string): Promise<AccountPlan> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!account) {
    throw new Error('Account not found');
  }

  const currentPlan = (account.plan ?? account.plan_tier) as PlanTier;
  const expiresAt = account.plan_expires_at;

  if (expiresAt && expiresAt.getTime() < Date.now()) {
    await db
      .update(accounts)
      .set({
        plan: 'free',
        plan_tier: 'free',
        plan_expires_at: null,
        updated_at: new Date(),
      })
      .where(eq(accounts.id, accountId));

    return { plan: 'free', isActive: false };
  }

  return {
    plan: currentPlan,
    isActive: currentPlan !== 'free',
  };
}
