ALTER TABLE "assets" ADD COLUMN "category" text DEFAULT 'other' NOT NULL;
--> statement-breakpoint
UPDATE "assets" SET "category" = 'cash' WHERE "id" = 'USD';
--> statement-breakpoint
UPDATE "assets" SET "category" = 'store-of-value' WHERE "id" = 'bitcoin';
--> statement-breakpoint
UPDATE "assets" SET "category" = 'layer-1' WHERE "id" IN ('ethereum', 'solana');
--> statement-breakpoint
UPDATE "assets" SET "category" = 'stablecoin' WHERE "id" IN ('tether', 'usd-coin');
