CREATE TABLE `signups` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`pending` text,
	`lang` text,
	`referrer` text,
	`account_id` text,
	`created_at` text NOT NULL,
	`verified_at` text,
	`onboarded_at` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `signups_email_idx` ON `signups` (`email`);--> statement-breakpoint
CREATE INDEX `signups_created_idx` ON `signups` (`created_at`);