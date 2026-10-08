CREATE TABLE "telegram_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"generation" uuid DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" text,
	"username" text,
	"link_hash" text,
	"link_expires_at" timestamp with time zone,
	"pending_chat_id" text,
	"pending_username" text,
	"buy_enabled" boolean DEFAULT true NOT NULL,
	"sell_enabled" boolean DEFAULT true NOT NULL,
	"portfolio_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_connections_chat_id_unique" UNIQUE("chat_id"),
	CONSTRAINT "telegram_connections_link_hash_unique" UNIQUE("link_hash")
);
--> statement-breakpoint
CREATE TABLE "telegram_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"generation" uuid NOT NULL,
	"watchlist_id" uuid NOT NULL,
	"side" text NOT NULL,
	"reached_at" timestamp with time zone NOT NULL,
	"target" numeric(48, 18) NOT NULL,
	"price" numeric(48, 18) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_delivery_side" CHECK ("telegram_deliveries"."side" IN ('buy','sell'))
);
--> statement-breakpoint
ALTER TABLE "telegram_connections" ADD CONSTRAINT "telegram_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_deliveries" ADD CONSTRAINT "telegram_deliveries_user_id_telegram_connections_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."telegram_connections"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_deliveries" ADD CONSTRAINT "telegram_deliveries_watchlist_id_watchlist_items_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlist_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_delivery_episode" ON "telegram_deliveries" USING btree ("watchlist_id","side","reached_at");--> statement-breakpoint
CREATE INDEX "telegram_delivery_due" ON "telegram_deliveries" USING btree ("next_attempt_at");