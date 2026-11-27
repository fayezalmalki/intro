CREATE TABLE `lead_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`account_id` text NOT NULL,
	`kind` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`at` text NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lead_activity_lead_idx` ON `lead_activity` (`lead_id`,`at`);--> statement-breakpoint
ALTER TABLE `leads` ADD `next_step` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `next_step_at` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `next_step_reminded_at` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `value` integer;--> statement-breakpoint
CREATE INDEX `leads_next_step_idx` ON `leads` (`next_step_at`);