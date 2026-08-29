ALTER TABLE "otp_codes" ADD COLUMN "code_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD COLUMN "send_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD COLUMN "first_sent_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "otp_codes" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;