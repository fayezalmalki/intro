CREATE TABLE `outbound` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`to_hash` text NOT NULL,
	`step` integer NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`variant_hash` text NOT NULL,
	`status` text NOT NULL,
	`failures` text DEFAULT '[]' NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `outbound_account_idx` ON `outbound` (`account_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `outbound_to_idx` ON `outbound` (`to_hash`,`created_at`);