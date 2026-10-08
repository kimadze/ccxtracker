ALTER TABLE "watchlist_items" ADD COLUMN "exit_price" numeric(48, 18);--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "sell_target_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "sell_target_quote_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "sell_target_reached_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "sell_target_reached_price" numeric(48, 18);--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "sell_target_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_exit_price_positive" CHECK ("watchlist_items"."exit_price" IS NULL OR "watchlist_items"."exit_price" > 0);