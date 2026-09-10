CREATE TABLE "radar_baselines" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"query_hash" text NOT NULL,
	"employee_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar_companies" (
	"id" text PRIMARY KEY NOT NULL,
	"cluster_slug" text NOT NULL,
	"name" text NOT NULL,
	"website" text NOT NULL,
	"coresignal_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "radar_issues" (
	"id" text PRIMARY KEY NOT NULL,
	"cluster_slug" text NOT NULL,
	"number" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title_ar" text DEFAULT '' NOT NULL,
	"intro_ar" text DEFAULT '' NOT NULL,
	"title_en" text DEFAULT '' NOT NULL,
	"intro_en" text DEFAULT '' NOT NULL,
	"published_at" timestamp,
	"broadcast_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "radar_issues_published_needs_date" CHECK ("radar_issues"."status" <> 'published' or "radar_issues"."published_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "radar_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"companies_checked" integer DEFAULT 0 NOT NULL,
	"signals_detected" integer DEFAULT 0 NOT NULL,
	"skips" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "radar_signals" (
	"id" text PRIMARY KEY NOT NULL,
	"cluster_slug" text NOT NULL,
	"company_id" text NOT NULL,
	"coresignal_employee_id" integer NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'detected' NOT NULL,
	"person_name" text,
	"person_title" text,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note_ar" text DEFAULT '' NOT NULL,
	"note_en" text DEFAULT '' NOT NULL,
	"credits_spent" integer DEFAULT 0 NOT NULL,
	"issue_id" text,
	"detected_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	CONSTRAINT "radar_signals_approved_needs_name" CHECK ("radar_signals"."status" in ('detected','removed') or "radar_signals"."person_name" is not null),
	CONSTRAINT "radar_signals_approved_needs_evidence" CHECK ("radar_signals"."status" in ('detected','removed') or jsonb_array_length("radar_signals"."evidence") > 0)
);
--> statement-breakpoint
CREATE TABLE "radar_subscribers" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"clusters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"token" text NOT NULL,
	"lang" text DEFAULT 'ar' NOT NULL,
	"confirmed_at" timestamp,
	"unsubscribed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "radar_subscribers_confirmed_needs_date" CHECK ("radar_subscribers"."status" <> 'confirmed' or "radar_subscribers"."confirmed_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "radar_baselines" ADD CONSTRAINT "radar_baselines_company_id_radar_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."radar_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_signals" ADD CONSTRAINT "radar_signals_company_id_radar_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."radar_companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "radar_baselines_company_idx" ON "radar_baselines" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_companies_site_idx" ON "radar_companies" USING btree ("cluster_slug","website");--> statement-breakpoint
CREATE INDEX "radar_companies_cluster_idx" ON "radar_companies" USING btree ("cluster_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_issues_number_idx" ON "radar_issues" USING btree ("cluster_slug","number");--> statement-breakpoint
CREATE INDEX "radar_runs_started_idx" ON "radar_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_signals_change_idx" ON "radar_signals" USING btree ("company_id","coresignal_employee_id","kind");--> statement-breakpoint
CREATE INDEX "radar_signals_cluster_status_idx" ON "radar_signals" USING btree ("cluster_slug","status");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_subscribers_email_idx" ON "radar_subscribers" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "radar_subscribers_token_idx" ON "radar_subscribers" USING btree ("token");