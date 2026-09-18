ALTER TABLE "transactions" DROP CONSTRAINT "transaction_kind_valid";--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "airdrop_source" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "airdrop_network" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "airdrop_status" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transaction_kind_valid" CHECK ("transactions"."kind" IN ('buy', 'sell', 'deposit', 'withdrawal', 'fee', 'airdrop'));