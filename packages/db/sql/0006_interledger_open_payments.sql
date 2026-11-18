CREATE TYPE "public"."payment_provider" AS ENUM('kora', 'interledger');--> statement-breakpoint
CREATE TYPE "public"."open_payments_grant_state" AS ENUM('created', 'incoming_created', 'quoted', 'awaiting_authorization', 'authorized', 'outgoing_created', 'verified', 'failed', 'expired');--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "interledger_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "interledger_environment" text DEFAULT 'testnet' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "interledger_wallet_address" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "interledger_auth_server" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "interledger_resource_server" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "interledger_asset_code" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "interledger_asset_scale" integer;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "interledger_client_wallet_address" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "interledger_key_id" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "interledger_status" text DEFAULT 'not_configured' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "interledger_last_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "kora_reference" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider" "payment_provider" DEFAULT 'kora' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_environment" text DEFAULT 'sandbox' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_reference" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "asset_code" text DEFAULT 'NGN' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "asset_scale" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_expected_amount" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_received_amount" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "is_simulated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "payments" SET "provider_reference" = "kora_reference" WHERE "provider_reference" IS NULL AND "kora_reference" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_ref_uq" ON "payments" USING btree ("provider","provider_reference");--> statement-breakpoint
CREATE TABLE "open_payments_attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"sender_wallet_address" text NOT NULL,
	"recipient_wallet_address" text NOT NULL,
	"incoming_payment_id" text,
	"quote_id" text,
	"outgoing_payment_id" text,
	"quote_debit_amount" text,
	"quote_debit_asset_code" text,
	"quote_debit_asset_scale" integer,
	"quote_receive_amount" text,
	"quote_expires_at" timestamp with time zone,
	"grant_state" "open_payments_grant_state" DEFAULT 'created' NOT NULL,
	"auth_nonce_hash" text,
	"interact_nonce" text,
	"continue_uri" text,
	"continue_access_token_enc" text,
	"outgoing_access_token_enc" text,
	"last_error_code" text,
	"last_error_message" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "open_payments_attempts_payment_id_uq" UNIQUE("payment_id")
);
--> statement-breakpoint
ALTER TABLE "open_payments_attempts" ADD CONSTRAINT "open_payments_attempts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_payments_attempts" ADD CONSTRAINT "open_payments_attempts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_payments_attempts" ADD CONSTRAINT "open_payments_attempts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "open_payments_attempts_auth_nonce_uq" ON "open_payments_attempts" USING btree ("auth_nonce_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "open_payments_attempts_incoming_id_uq" ON "open_payments_attempts" USING btree ("incoming_payment_id");--> statement-breakpoint
CREATE INDEX "open_payments_attempts_booking_id_idx" ON "open_payments_attempts" USING btree ("booking_id");
