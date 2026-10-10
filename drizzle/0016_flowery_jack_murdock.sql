CREATE TABLE "take_profit_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"generation" uuid NOT NULL,
	"connection_generation" uuid NOT NULL,
	"reached_at" timestamp with time zone NOT NULL,
	"price" numeric(48, 18) NOT NULL,
	"levels" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exit_plan_levels" ADD COLUMN "alert_quote_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exit_plan_levels" ADD COLUMN "alert_armed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exit_plan_levels" ADD COLUMN "reached_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exit_plan_levels" ADD COLUMN "reached_price" numeric(48, 18);--> statement-breakpoint
ALTER TABLE "exit_plans" ADD COLUMN "telegram_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exit_plans" ADD COLUMN "alert_quantity" numeric(48, 18);--> statement-breakpoint
ALTER TABLE "exit_plans" ADD COLUMN "alert_generation" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "take_profit_deliveries" ADD CONSTRAINT "take_profit_deliveries_plan_id_exit_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."exit_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "take_profit_delivery_episode" ON "take_profit_deliveries" USING btree ("plan_id","generation","reached_at");--> statement-breakpoint
CREATE INDEX "take_profit_delivery_due" ON "take_profit_deliveries" USING btree ("next_attempt_at");