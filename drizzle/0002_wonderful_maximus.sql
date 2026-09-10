CREATE TABLE "exit_plan_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"price" numeric(48, 18) NOT NULL,
	"percentage" numeric(48, 18) NOT NULL,
	CONSTRAINT "exit_price_positive" CHECK ("exit_plan_levels"."price" > 0),
	CONSTRAINT "exit_weight_valid" CHECK ("exit_plan_levels"."percentage" > 0 AND "exit_plan_levels"."percentage" <= 100)
);
--> statement-breakpoint
CREATE TABLE "exit_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"asset_id" text NOT NULL,
	"fee_percent" numeric(48, 18) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_id" uuid NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"name" text NOT NULL,
	"blob_path" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "position_journals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"asset_id" text NOT NULL,
	"thesis" text DEFAULT '' NOT NULL,
	"entry_reason" text DEFAULT '' NOT NULL,
	"catalysts" text DEFAULT '' NOT NULL,
	"invalidation" text DEFAULT '' NOT NULL,
	"targets" text DEFAULT '' NOT NULL,
	"conviction" text DEFAULT 'medium' NOT NULL,
	"horizon" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exit_plan_levels" ADD CONSTRAINT "exit_plan_levels_plan_id_exit_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."exit_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exit_plans" ADD CONSTRAINT "exit_plans_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exit_plans" ADD CONSTRAINT "exit_plans_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- The referenced composite unique index must exist before this foreign key.
CREATE UNIQUE INDEX "journal_id_portfolio_unique" ON "position_journals" USING btree ("id","portfolio_id");--> statement-breakpoint
ALTER TABLE "journal_attachments" ADD CONSTRAINT "journal_attachments_journal_id_portfolio_id_position_journals_id_portfolio_id_fk" FOREIGN KEY ("journal_id","portfolio_id") REFERENCES "public"."position_journals"("id","portfolio_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_journals" ADD CONSTRAINT "position_journals_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_journals" ADD CONSTRAINT "position_journals_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exit_level_order_unique" ON "exit_plan_levels" USING btree ("plan_id","level");--> statement-breakpoint
CREATE UNIQUE INDEX "exit_plan_portfolio_asset_unique" ON "exit_plans" USING btree ("portfolio_id","asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exit_plan_id_portfolio_unique" ON "exit_plans" USING btree ("id","portfolio_id");--> statement-breakpoint
CREATE INDEX "attachments_journal_idx" ON "journal_attachments" USING btree ("journal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_portfolio_asset_unique" ON "position_journals" USING btree ("portfolio_id","asset_id");--> statement-breakpoint
