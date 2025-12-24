import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  numeric,
  boolean,
  pgEnum,
  inet,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Enums
export const planTierEnum = pgEnum('plan_tier', ['free', 'pro', 'enterprise']);
export const accountStatusEnum = pgEnum('account_status', ['active', 'suspended', 'churned']);
export const senderTypeEnum = pgEnum('sender_type', ['buyer', 'seller', 'claude']);

// accounts
export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  plan_tier: planTierEnum('plan_tier').notNull().default('free'),
  status: accountStatusEnum('status').notNull().default('active'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// users
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    account_id: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    email: text('email'),
    device_fingerprint: text('device_fingerprint').notNull().unique(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    last_seen_at: timestamp('last_seen_at', { withTimezone: true }),
  },
  (t) => ({
    idx_users_account_id: index('idx_users_account_id').on(t.account_id),
    idx_users_device_fingerprint: index('idx_users_device_fingerprint').on(t.device_fingerprint),
  })
);

// threads
export const threads = pgTable(
  'threads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    account_id: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fb_thread_id: text('fb_thread_id').notNull(),
    listing_data: jsonb('listing_data'),
    status: text('status').notNull().default('active'),
    intent_score: numeric('intent_score', { precision: 3, scale: 2 }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idx_threads_account_id: index('idx_threads_account_id').on(t.account_id),
    idx_threads_fb_thread_id: uniqueIndex('idx_threads_fb_thread_id').on(t.account_id, t.fb_thread_id),
  })
);

// messages
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    thread_id: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    sender_type: senderTypeEnum('sender_type').notNull(),
    text: text('text').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    was_sent_auto: boolean('was_sent_auto').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idx_messages_thread_id: index('idx_messages_thread_id').on(t.thread_id, t.timestamp),
  })
);

// actions (audit log)
export const actions = pgTable(
  'actions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    account_id: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    thread_id: uuid('thread_id').references(() => threads.id, { onDelete: 'set null' }),
    action_type: text('action_type').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    ip_address: inet('ip_address'),
    user_agent: text('user_agent'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    idx_actions_account_id: index('idx_actions_account_id').on(t.account_id, t.created_at),
    idx_actions_type: index('idx_actions_type').on(t.action_type, t.created_at),
  })
);

// Type exports
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type Action = typeof actions.$inferSelect;
export type NewAction = typeof actions.$inferInsert;
