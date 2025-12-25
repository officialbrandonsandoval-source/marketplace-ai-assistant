ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "plan" "plan_tier" DEFAULT 'free' NOT NULL;
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "plan_expires_at" timestamp;

CREATE TABLE IF NOT EXISTS "account_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "global_instructions" text,
  "goal_presets" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "account_settings" ADD CONSTRAINT "account_settings_account_id_accounts_id_fk"
 FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_account_settings_account_id" ON "account_settings" USING btree ("account_id");
