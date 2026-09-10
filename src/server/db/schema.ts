import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  uuid,
  index,
  uniqueIndex,
  check,
  bigint,
  jsonb,
  date,
  foreignKey,
} from "drizzle-orm/pg-core";

const times = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
const financial = (name: string) => numeric(name, { precision: 48, scale: 18 });
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  ...times(),
});
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...times(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);
export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    ...times(),
  },
  (t) => [
    index("accounts_user_idx").on(t.userId),
    uniqueIndex("accounts_provider_unique").on(t.providerId, t.accountId),
  ],
);
export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...times(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
export const rateLimits = pgTable("rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const portfolios = pgTable(
  "portfolios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    baseCurrency: text("base_currency").default("USD").notNull(),
    revision: integer("revision").default(0).notNull(),
    ...times(),
  },
  (t) => [
    index("portfolios_user_idx").on(t.userId),
    check("portfolio_currency", sql`${t.baseCurrency} = 'USD'`),
  ],
);
export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  providerId: text("provider_id").notNull().unique(),
  logoUrl: text("logo_url"),
  isStablecoin: boolean("is_stablecoin").default(false).notNull(),
  category: text("category").default("other").notNull(),
  ...times(),
});
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id),
    kind: text("kind", {
      enum: ["buy", "sell", "deposit", "withdrawal", "fee"],
    }).notNull(),
    quantity: financial("quantity").notNull(),
    price: financial("price"),
    fee: financial("fee").default("0").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    sequence: integer("sequence").notNull(),
    notes: text("notes").default("").notNull(),
    ...times(),
  },
  (t) => [
    index("transactions_portfolio_time_idx").on(t.portfolioId, t.occurredAt),
    uniqueIndex("transactions_sequence_unique").on(t.portfolioId, t.sequence),
    check("transaction_quantity_positive", sql`${t.quantity} > 0`),
    check(
      "transaction_price_nonnegative",
      sql`${t.price} IS NULL OR ${t.price} >= 0`,
    ),
    check("transaction_fee_nonnegative", sql`${t.fee} >= 0`),
    check(
      "transaction_kind_valid",
      sql`${t.kind} IN ('buy', 'sell', 'deposit', 'withdrawal', 'fee')`,
    ),
  ],
);
export const positions = pgTable(
  "positions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id),
    quantity: financial("quantity").notNull(),
    costBasis: financial("cost_basis"),
    realizedPnl: financial("realized_pnl"),
    ...times(),
  },
  (t) => [
    uniqueIndex("positions_portfolio_asset_unique").on(
      t.portfolioId,
      t.assetId,
    ),
    check("position_quantity_nonnegative", sql`${t.quantity} >= 0`),
  ],
);
export const marketQuotes = pgTable(
  "market_quotes",
  {
    assetId: text("asset_id")
      .primaryKey()
      .references(() => assets.id, { onDelete: "cascade" }),
    price: financial("price").notNull(),
    change24h: financial("change_24h"),
    quotedAt: timestamp("quoted_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [check("quote_price_positive", sql`${t.price} > 0`)],
);
export const audits = pgTable("audit_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  portfolioId: uuid("portfolio_id")
    .notNull()
    .references(() => portfolios.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  operation: text("operation").notNull(),
  before: jsonb("before"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const snapshots = pgTable(
  "portfolio_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
    value: financial("value").notNull(),
    cash: financial("cash").notNull(),
    realizedPnl: financial("realized_pnl"),
    unrealizedPnl: financial("unrealized_pnl"),
    revision: integer("revision").notNull(),
  },
  (t) => [
    uniqueIndex("snapshots_portfolio_day_unique").on(t.portfolioId, t.day),
    index("snapshots_portfolio_time_idx").on(t.portfolioId, t.capturedAt),
  ],
);
export const jobState = pgTable("job_state", {
  key: text("key").primaryKey(),
  cursor: text("cursor"),
  leaseUntil: timestamp("lease_until", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const exitPlans = pgTable(
  "exit_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id),
    feePercent: financial("fee_percent").default("0").notNull(),
    ...times(),
  },
  (t) => [
    uniqueIndex("exit_plan_portfolio_asset_unique").on(
      t.portfolioId,
      t.assetId,
    ),
    uniqueIndex("exit_plan_id_portfolio_unique").on(t.id, t.portfolioId),
  ],
);
export const exitLevels = pgTable(
  "exit_plan_levels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => exitPlans.id, { onDelete: "cascade" }),
    level: integer("level").notNull(),
    price: financial("price").notNull(),
    percentage: financial("percentage").notNull(),
  },
  (t) => [
    uniqueIndex("exit_level_order_unique").on(t.planId, t.level),
    check("exit_price_positive", sql`${t.price} > 0`),
    check(
      "exit_weight_valid",
      sql`${t.percentage} > 0 AND ${t.percentage} <= 100`,
    ),
  ],
);
export const journals = pgTable(
  "position_journals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id),
    thesis: text("thesis").default("").notNull(),
    entryReason: text("entry_reason").default("").notNull(),
    catalysts: text("catalysts").default("").notNull(),
    invalidation: text("invalidation").default("").notNull(),
    targets: text("targets").default("").notNull(),
    conviction: text("conviction", { enum: ["low", "medium", "high"] })
      .default("medium")
      .notNull(),
    horizon: text("horizon").default("").notNull(),
    notes: text("notes").default("").notNull(),
    ...times(),
  },
  (t) => [
    uniqueIndex("journal_portfolio_asset_unique").on(t.portfolioId, t.assetId),
    uniqueIndex("journal_id_portfolio_unique").on(t.id, t.portfolioId),
  ],
);
export const journalAttachments = pgTable(
  "journal_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    journalId: uuid("journal_id").notNull(),
    portfolioId: uuid("portfolio_id").notNull(),
    name: text("name").notNull(),
    blobPath: text("blob_path").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.journalId, t.portfolioId],
      foreignColumns: [journals.id, journals.portfolioId],
    }).onDelete("cascade"),
    index("attachments_journal_idx").on(t.journalId),
  ],
);
export const scenarios = pgTable(
  "portfolio_scenarios",
  {
    id: uuid("id").primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ...times(),
  },
  (t) => [index("scenarios_portfolio_idx").on(t.portfolioId)],
);
export const scenarioPrices = pgTable(
  "scenario_asset_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id),
    price: financial("price").notNull(),
  },
  (t) => [
    uniqueIndex("scenario_asset_unique").on(t.scenarioId, t.assetId),
    check("scenario_price_nonnegative", sql`${t.price} >= 0`),
  ],
);
export const portfolioTargets = pgTable(
  "portfolio_targets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" })
      .unique(),
    target: financial("target").notNull(),
    milestones: jsonb("milestones").$type<string[]>().default([]).notNull(),
    ...times(),
  },
  (t) => [check("goal_target_positive", sql`${t.target} > 0`)],
);
export const targetAllocations = pgTable(
  "target_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id),
    weight: financial("weight").notNull(),
    ...times(),
  },
  (t) => [
    uniqueIndex("allocation_portfolio_asset_unique").on(
      t.portfolioId,
      t.assetId,
    ),
    check(
      "allocation_weight_valid",
      sql`${t.weight} >= 0 AND ${t.weight} <= 100`,
    ),
  ],
);
export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id),
    entryPrice: financial("entry_price"),
    notes: text("notes").default("").notNull(),
    ...times(),
  },
  (t) => [
    uniqueIndex("watchlist_portfolio_asset_unique").on(
      t.portfolioId,
      t.assetId,
    ),
    check(
      "watchlist_price_positive",
      sql`${t.entryPrice} IS NULL OR ${t.entryPrice} > 0`,
    ),
  ],
);
export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  timezone: text("timezone").default("Asia/Tbilisi").notNull(),
  displayCurrency: text("display_currency").default("USD").notNull(),
  ...times(),
});
