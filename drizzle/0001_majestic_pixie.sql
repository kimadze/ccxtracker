CREATE TABLE "job_state" (
	"key" text PRIMARY KEY NOT NULL,
	"cursor" text,
	"lease_until" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"day" date NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"value" numeric(48, 18) NOT NULL,
	"cash" numeric(48, 18) NOT NULL,
	"realized_pnl" numeric(48, 18),
	"unrealized_pnl" numeric(48, 18),
	"revision" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_portfolio_day_unique" ON "portfolio_snapshots" USING btree ("portfolio_id","day");--> statement-breakpoint
CREATE INDEX "snapshots_portfolio_time_idx" ON "portfolio_snapshots" USING btree ("portfolio_id","captured_at");