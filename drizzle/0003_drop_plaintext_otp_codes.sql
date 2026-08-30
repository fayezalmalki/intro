CREATE TABLE "api_call_log" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"endpoint" text NOT NULL,
	"args_hash" text NOT NULL,
	"credits_spent" integer DEFAULT 0 NOT NULL,
	"credits_remaining" integer,
	"account_id" text,
	"response" jsonb,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"account_id" text,
	"email" text,
	"meta" jsonb,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "api_call_log" ADD CONSTRAINT "api_call_log_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_call_log_args_idx" ON "api_call_log" USING btree ("provider","endpoint","args_hash") WHERE "api_call_log"."credits_spent" > 0;--> statement-breakpoint
CREATE INDEX "api_call_log_at_idx" ON "api_call_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "usage_events_kind_at_idx" ON "usage_events" USING btree ("kind","at");--> statement-breakpoint
CREATE INDEX "usage_events_at_idx" ON "usage_events" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_idx" ON "webhook_events" USING btree ("provider","event_id");--> statement-breakpoint
ALTER TABLE "otp_codes" DROP COLUMN "code";