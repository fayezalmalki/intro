ALTER TABLE `accounts` ADD `company` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `company_website` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `job_title` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `use_case` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `linkedin_url` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `locale` text DEFAULT 'ar' NOT NULL;--> statement-breakpoint
ALTER TABLE `accounts` ADD `onboarded_at` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `activation_requested_at` text;--> statement-breakpoint
ALTER TABLE `accounts` ADD `activation_note` text;