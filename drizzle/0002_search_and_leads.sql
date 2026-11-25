CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`person_id` text NOT NULL,
	`source` text DEFAULT 'search' NOT NULL,
	`market` text,
	`email` text,
	`email_status` text,
	`revealed_at` text,
	`signals` text,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leads_account_person_idx` ON `leads` (`account_id`,`person_id`);--> statement-breakpoint
CREATE INDEX `leads_account_idx` ON `leads` (`account_id`);--> statement-breakpoint
CREATE TABLE `search_log` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`kind` text NOT NULL,
	`query` text NOT NULL,
	`results` integer DEFAULT 0 NOT NULL,
	`cost_micro` integer DEFAULT 0 NOT NULL,
	`served_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `search_log_account_day_idx` ON `search_log` (`account_id`,`created_at`);