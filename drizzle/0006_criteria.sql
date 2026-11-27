CREATE TABLE `criteria` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`market` text NOT NULL,
	`sector` text,
	`keywords` text,
	`role` text,
	`signal` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `criteria_account_idx` ON `criteria` (`account_id`);