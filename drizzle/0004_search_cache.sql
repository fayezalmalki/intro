CREATE TABLE `search_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`results` text NOT NULL,
	`count` integer NOT NULL,
	`cost_micro` integer DEFAULT 0 NOT NULL,
	`hits` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `search_log` ADD `cache_key` text;--> statement-breakpoint
ALTER TABLE `search_log` ADD `billing` text;--> statement-breakpoint
ALTER TABLE `search_log` ADD `cached` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `search_log_account_key_idx` ON `search_log` (`account_id`,`cache_key`);