CREATE TABLE "target_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"asset_id" text NOT NULL,
	"weight" numeric(48, 18) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allocation_weight_valid" CHECK ("target_allocations"."weight" >= 0 AND "target_allocations"."weight" <= 100)
);
--> statement-breakpoint
ALTER TABLE "target_allocations" ADD CONSTRAINT "target_allocations_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_allocations" ADD CONSTRAINT "target_allocations_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "allocation_portfolio_asset_unique" ON "target_allocations" USING btree ("portfolio_id","asset_id");