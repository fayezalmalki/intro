CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`initial` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'requester' NOT NULL,
	`state` text DEFAULT 'observer' NOT NULL,
	`verified_at` text,
	`daily_cap` integer DEFAULT 10 NOT NULL,
	`frozen_at` text,
	`frozen_reason` text,
	`assigned_am` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_user_id_idx` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text NOT NULL,
	`actor` text NOT NULL,
	`entity` text NOT NULL,
	`action` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_events` (`entity`);--> statement-breakpoint
CREATE TABLE `auth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_accounts_user_idx` ON `auth_accounts` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`count` integer NOT NULL,
	`last_request` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_rate_limits_key_unique` ON `auth_rate_limits` (`key`);--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_unique` ON `auth_sessions` (`token`);--> statement-breakpoint
CREATE INDEX `auth_sessions_user_idx` ON `auth_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `auth_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_users_email_unique` ON `auth_users` (`email`);--> statement-breakpoint
CREATE TABLE `auth_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `auth_verifications_identifier_idx` ON `auth_verifications` (`identifier`);--> statement-breakpoint
CREATE TABLE `ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`ref` text,
	`at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_idempotency_idx` ON `ledger` (`account_id`,`reason`,`ref`);--> statement-breakpoint
CREATE INDEX `ledger_account_idx` ON `ledger` (`account_id`);--> statement-breakpoint
CREATE TABLE `list_members` (
	`list_id` text NOT NULL,
	`person_id` text NOT NULL,
	PRIMARY KEY(`list_id`, `person_id`),
	FOREIGN KEY (`list_id`) REFERENCES `people_lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `outreach` (
	`request_id` text NOT NULL,
	`person_id` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`request_id`, `person_id`),
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`latin` text NOT NULL,
	`first_ar` text NOT NULL,
	`title` text NOT NULL,
	`company` text NOT NULL,
	`company_domain` text,
	`geo` text NOT NULL,
	`industries` text DEFAULT '[]' NOT NULL,
	`seniority` text NOT NULL,
	`linkedin_url` text,
	`email` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`open_to_intros` integer DEFAULT false NOT NULL,
	`source` text NOT NULL,
	`served_by` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_linkedin_idx` ON `people` (`linkedin_url`);--> statement-breakpoint
CREATE INDEX `people_email_idx` ON `people` (`email`);--> statement-breakpoint
CREATE INDEX `people_company_domain_idx` ON `people` (`company_domain`);--> statement-breakpoint
CREATE TABLE `people_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pipeline_items` (
	`id` text PRIMARY KEY NOT NULL,
	`pipeline_id` text NOT NULL,
	`person_id` text NOT NULL,
	`rank` integer NOT NULL,
	`fit` text NOT NULL,
	`thin` integer DEFAULT false NOT NULL,
	`why` text NOT NULL,
	`why_now` text NOT NULL,
	`role_relevance` text NOT NULL,
	`company_relevance` text NOT NULL,
	`timing` text NOT NULL,
	`lead_with` text NOT NULL,
	`avoid` text NOT NULL,
	`opener` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`am_note` text,
	`evidence` text DEFAULT '[]' NOT NULL,
	`generated_by` text NOT NULL,
	FOREIGN KEY (`pipeline_id`) REFERENCES `pipelines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pipeline_items_pipeline_idx` ON `pipeline_items` (`pipeline_id`);--> statement-breakpoint
CREATE TABLE `pipelines` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`version` integer NOT NULL,
	`source` text NOT NULL,
	`status` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`published_at` text,
	`note` text,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pipelines_request_version_idx` ON `pipelines` (`request_id`,`version`);--> statement-breakpoint
CREATE INDEX `pipelines_request_status_idx` ON `pipelines` (`request_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `pipelines_one_published_idx` ON `pipelines` (`request_id`) WHERE status = 'published';--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`requester_name` text NOT NULL,
	`requester_initial` text NOT NULL,
	`raw_text` text NOT NULL,
	`status` text NOT NULL,
	`goal_type` text,
	`use_case` text,
	`sectors` text DEFAULT '[]' NOT NULL,
	`brief` text,
	`confirmed_at` text,
	`assigned_am` text,
	`sourcing_cost_micro` integer DEFAULT 0 NOT NULL,
	`workflow_id` text,
	`created_at` text NOT NULL,
	`due_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `requests_account_idx` ON `requests` (`account_id`);--> statement-breakpoint
CREATE TABLE `send_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`request_id` text NOT NULL,
	`person_id` text NOT NULL,
	`pool` text NOT NULL,
	`channel` text NOT NULL,
	`body` text NOT NULL,
	`variant_hash` text NOT NULL,
	`result` text NOT NULL,
	`gate_failures` text DEFAULT '[]' NOT NULL,
	`provider_message_id` text,
	`at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`request_id`) REFERENCES `requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `send_attempts_account_at_idx` ON `send_attempts` (`account_id`,`at`);--> statement-breakpoint
CREATE INDEX `send_attempts_person_idx` ON `send_attempts` (`person_id`);--> statement-breakpoint
CREATE TABLE `suppressions` (
	`email_hash` text PRIMARY KEY NOT NULL,
	`reason` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL
);
