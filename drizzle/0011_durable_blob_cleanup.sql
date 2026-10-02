CREATE TABLE IF NOT EXISTS "blob_cleanup_jobs" (
  "blob_path" text PRIMARY KEY NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blob_cleanup_next_attempt_idx"
  ON "blob_cleanup_jobs" USING btree ("next_attempt_at");
