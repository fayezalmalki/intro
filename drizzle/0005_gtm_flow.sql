CREATE TABLE "checkouts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text NOT NULL,
	"product" text DEFAULT 'intro' NOT NULL,
	"credits" integer NOT NULL,
	"amount_halalas" integer NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"settled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "company_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"account_id" text NOT NULL,
	"website_url" text NOT NULL,
	"name" text NOT NULL,
	"sells" text DEFAULT '' NOT NULL,
	"market" text DEFAULT '' NOT NULL,
	"size_signal" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'ar' NOT NULL,
	"offerings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"competitors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text NOT NULL,
	"source_excerpt" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gtm_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"website_url" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intro_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"person_id" text NOT NULL,
	"account_id" text NOT NULL,
	"segment_id" text NOT NULL,
	"template" text DEFAULT 'direct' NOT NULL,
	"lang" text DEFAULT 'ar' NOT NULL,
	"subject_ar" text DEFAULT '' NOT NULL,
	"body_ar" text DEFAULT '' NOT NULL,
	"subject_en" text DEFAULT '' NOT NULL,
	"body_en" text DEFAULT '' NOT NULL,
	"specifics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'prepared' NOT NULL,
	"provider_message_id" text,
	"sent_at" timestamp,
	"edited_by_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "intro_drafts_sent_needs_provider_id" CHECK ("intro_drafts"."status" <> 'sent' or "intro_drafts"."provider_message_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"account_id" text NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT '◆' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"pain" text DEFAULT '' NOT NULL,
	"criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"example_companies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"match_count" integer,
	"count_query" jsonb,
	"count_endpoint" text,
	"count_source" text DEFAULT 'unavailable' NOT NULL,
	"count_error" text,
	"counted_at" timestamp,
	"origin" text DEFAULT 'ai' NOT NULL,
	"removed_at" timestamp,
	CONSTRAINT "segments_count_needs_query" CHECK ("segments"."match_count" is null or ("segments"."count_query" is not null and "segments"."count_source" = 'coresignal'))
);
--> statement-breakpoint
CREATE TABLE "target_companies" (
	"id" text PRIMARY KEY NOT NULL,
	"segment_id" text NOT NULL,
	"account_id" text NOT NULL,
	"coresignal_id" integer,
	"name" text NOT NULL,
	"website" text,
	"linkedin_url" text,
	"employees_count" integer,
	"industry" text,
	"hq_country" text,
	"kept" boolean DEFAULT false NOT NULL,
	"enriched_at" timestamp,
	"source" text DEFAULT 'search' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "target_people" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text,
	"segment_id" text NOT NULL,
	"account_id" text NOT NULL,
	"coresignal_id" integer,
	"full_name" text NOT NULL,
	"first_name" text,
	"title" text DEFAULT '' NOT NULL,
	"company_name" text DEFAULT '' NOT NULL,
	"linkedin_url" text,
	"email" text,
	"email_status" text,
	"kept" boolean DEFAULT false NOT NULL,
	"collected_at" timestamp,
	"source" text DEFAULT 'search' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "target_people_email_needs_status" CHECK ("target_people"."email" is null or "target_people"."email_status" is not null)
);
--> statement-breakpoint
ALTER TABLE "checkouts" ADD CONSTRAINT "checkouts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_run_id_gtm_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."gtm_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_runs" ADD CONSTRAINT "gtm_runs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intro_drafts" ADD CONSTRAINT "intro_drafts_person_id_target_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."target_people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intro_drafts" ADD CONSTRAINT "intro_drafts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intro_drafts" ADD CONSTRAINT "intro_drafts_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_run_id_gtm_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."gtm_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_companies" ADD CONSTRAINT "target_companies_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_companies" ADD CONSTRAINT "target_companies_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_people" ADD CONSTRAINT "target_people_company_id_target_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."target_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_people" ADD CONSTRAINT "target_people_segment_id_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_people" ADD CONSTRAINT "target_people_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checkouts_provider_ref_idx" ON "checkouts" USING btree ("provider","provider_ref");--> statement-breakpoint
CREATE INDEX "checkouts_account_idx" ON "checkouts" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_profiles_run_idx" ON "company_profiles" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "gtm_runs_account_idx" ON "gtm_runs" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "intro_drafts_person_idx" ON "intro_drafts" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "intro_drafts_segment_idx" ON "intro_drafts" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "segments_run_idx" ON "segments" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "target_companies_segment_idx" ON "target_companies" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "target_people_segment_idx" ON "target_people" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "target_people_company_idx" ON "target_people" USING btree ("company_id");