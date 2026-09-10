CREATE TABLE "portfolio_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"target" numeric(48, 18) NOT NULL,
	"milestones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_targets_portfolio_id_unique" UNIQUE("portfolio_id"),
	CONSTRAINT "goal_target_positive" CHECK ("portfolio_targets"."target" > 0)
);
--> statement-breakpoint
CREATE TABLE "scenario_asset_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"asset_id" text NOT NULL,
	"price" numeric(48, 18) NOT NULL,
	CONSTRAINT "scenario_price_nonnegative" CHECK ("scenario_asset_prices"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "portfolio_scenarios" (
	"id" uuid PRIMARY KEY NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_targets" ADD CONSTRAINT "portfolio_targets_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_asset_prices" ADD CONSTRAINT "scenario_asset_prices_scenario_id_portfolio_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."portfolio_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_asset_prices" ADD CONSTRAINT "scenario_asset_prices_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_scenarios" ADD CONSTRAINT "portfolio_scenarios_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "scenario_asset_unique" ON "scenario_asset_prices" USING btree ("scenario_id","asset_id");--> statement-breakpoint
CREATE INDEX "scenarios_portfolio_idx" ON "portfolio_scenarios" USING btree ("portfolio_id");