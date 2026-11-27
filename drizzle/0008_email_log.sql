CREATE TABLE `email_log` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`to` text NOT NULL,
	`transport` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `email_log_created_idx` ON `email_log` (`created_at`);