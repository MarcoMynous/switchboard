ALTER TABLE "businesses" ADD COLUMN "free_cancel_hours" integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "merchant_bears_cost" boolean DEFAULT false NOT NULL;