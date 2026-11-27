ALTER TABLE `leads` ADD `stage` text DEFAULT 'saved' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `contacted_at` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `follow_up_at` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `follow_ups` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `last_touch_at` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `reminded_at` text;--> statement-breakpoint
CREATE INDEX `leads_follow_up_idx` ON `leads` (`follow_up_at`);