ALTER TABLE "watchlist_items" ADD COLUMN "target_active" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "target_quote_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "target_reached_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "target_reached_price" numeric(48, 18);--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "target_read_at" timestamp with time zone;