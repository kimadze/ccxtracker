CREATE TABLE "telegram_digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"generation" uuid NOT NULL,
	"day" date NOT NULL,
	"portfolio_ids" jsonb NOT NULL,
	"body" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telegram_connections" ADD COLUMN "summary_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_connections" ADD COLUMN "summary_ai_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_connections" ADD COLUMN "summary_hour" integer DEFAULT 21 NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_digests" ADD CONSTRAINT "telegram_digests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_digest_user_day" ON "telegram_digests" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "telegram_digest_due" ON "telegram_digests" USING btree ("next_attempt_at");