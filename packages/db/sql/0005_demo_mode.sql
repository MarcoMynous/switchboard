ALTER TABLE "businesses" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "demo_session_id" text;--> statement-breakpoint
CREATE INDEX "businesses_is_demo_idx" ON "businesses" USING btree ("is_demo");--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_demo_session_id_unique" UNIQUE("demo_session_id");