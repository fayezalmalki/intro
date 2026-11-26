CREATE TABLE `credit_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`package` text NOT NULL,
	`credits` integer NOT NULL,
	`amount_halalas` integer NOT NULL,
	`invoice_id` text,
	`status` text DEFAULT 'created' NOT NULL,
	`created_at` text NOT NULL,
	`paid_at` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `credit_orders_account_idx` ON `credit_orders` (`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `credit_orders_invoice_idx` ON `credit_orders` (`invoice_id`);