CREATE TABLE "wallet_portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"network" text NOT NULL,
	"config" jsonb NOT NULL,
	"snapshot" jsonb,
	"last_attempt_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_network" CHECK ("wallet_portfolios"."network" IN ('stellar','bitcoin'))
);
--> statement-breakpoint
ALTER TABLE "wallet_portfolios" ADD CONSTRAINT "wallet_portfolios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_portfolios_user_idx" ON "wallet_portfolios" USING btree ("user_id");

