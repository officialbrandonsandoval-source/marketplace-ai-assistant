import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  jsonb,
  numeric,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const planTierEnum = pgEnum('plan_tier', ['free', 'pro', 'enterprise']);
export const statusEnum = pgEnum('status', ['active', 'suspended', 'churned']);
export const senderTypeEnum = pgEnum('sender_type', ['buyer', 'seller', 'claude']);

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  plan_tier: planTierEnum('plan_tier').notNull().default('free'),
  plan: planTierEnum('plan').notNull().default('free'),
  plan_expires_at: timestamp('plan_expires_at'),
  status: statusEnum('status').notNull().default('active'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    account_id: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    email: text('email'),
    device_fingerprint: text('device_fingerprint').notNull(),
    created_at: timestamp('created_at').notNull().defaultNow(),
    last_seen_at: timestamp('last_seen_at'),
  },
  (table) => ({
    accountIdIdx: index('idx_users_account_id').on(table.account_id),
    deviceFingerprintIdx: uniqueIndex('idx_users_device_fingerprint').on(table.device_fingerprint),
  })
);

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
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    accountIdIdx: index('idx_threads_account_id').on(table.account_id),
    fbThreadIdIdx: uniqueIndex('idx_threads_fb_thread_id').on(table.account_id, table.fb_thread_id),
  })
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    thread_id: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    sender_type: senderTypeEnum('sender_type').notNull(),
    text: text('text').notNull(),
    timestamp: timestamp('timestamp').notNull(),
    was_sent_auto: boolean('was_sent_auto').notNull().default(false),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    threadIdIdx: index('idx_messages_thread_id').on(table.thread_id, table.timestamp),
  })
);

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
    ip_address: text('ip_address'),
    user_agent: text('user_agent'),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    accountIdIdx: index('idx_actions_account_id').on(table.account_id, table.created_at),
    actionTypeIdx: index('idx_actions_type').on(table.action_type, table.created_at),
  })
);

export const accountSettings = pgTable(
  'account_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    account_id: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    global_instructions: text('global_instructions'),
    goal_presets: jsonb('goal_presets').notNull().default([]),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    accountIdIdx: uniqueIndex('idx_account_settings_account_id').on(table.account_id),
  })
);

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
export type AccountSetting = typeof accountSettings.$inferSelect;
export type NewAccountSetting = typeof accountSettings.$inferInsert;
