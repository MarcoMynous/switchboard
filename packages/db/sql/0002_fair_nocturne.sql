CREATE TYPE "public"."service_deposit_type" AS ENUM('fixed', 'percent', 'none', 'full');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('owner', 'staff');--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_min" integer NOT NULL,
	"price_kobo" bigint NOT NULL,
	"deposit_type" "service_deposit_type" DEFAULT 'fixed' NOT NULL,
	"deposit_value" bigint DEFAULT 0 NOT NULL,
	"free_cancel_hours" integer DEFAULT 4 NOT NULL,
	"deposit_counts_toward_bill" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY NOT NULL,
	"business_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" "staff_role" DEFAULT 'staff' NOT NULL,
	"role_title" text DEFAULT 'Staff Provider' NOT NULL,
	"user_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_services" (
	"staff_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	CONSTRAINT "staff_services_staff_id_service_id_pk" PRIMARY KEY("staff_id","service_id")
);
--> statement-breakpoint
CREATE TABLE "working_hours" (
	"id" uuid PRIMARY KEY NOT NULL,
	"staff_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_local" time NOT NULL,
	"end_local" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "country" text DEFAULT 'Nigeria (NG)' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "self_provided" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "schedule" jsonb;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "advance_days" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "allow_same_day" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "deposit_required" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "deposit_type" text DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "default_deposit_kobo" bigint DEFAULT 150000 NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "cancellation_policy" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "kora_status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "assistant_name" text DEFAULT 'Maya' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "greeting" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "tone" text DEFAULT 'Friendly' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "capabilities" jsonb;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "onboarding_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_services" ADD CONSTRAINT "staff_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "working_hours" ADD CONSTRAINT "working_hours_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "services_business_id_idx" ON "services" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "staff_business_id_idx" ON "staff" USING btree ("business_id");--> statement-breakpoint
CREATE INDEX "working_hours_staff_id_idx" ON "working_hours" USING btree ("staff_id");--> statement-breakpoint
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "businesses_owner_user_id_idx" ON "businesses" USING btree ("owner_user_id");