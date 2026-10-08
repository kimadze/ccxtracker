import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readdir, readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import type { Database } from "@/server/db";
import { portfolioService } from "@/server/services/portfolio";
import {
  previewTransactionChange,
  restoreTransaction,
  saveOpeningAssets,
} from "@/server/transaction-features";
import { evaluateWatchlistTargets } from "@/server/services/watchlist-notifications";
import { watchlistService } from "@/server/services/watchlist";
import {
  loadTargetNotifications,
  readTargetNotification,
} from "@/server/notification-actions";
import type { Quote } from "@/domain/types";
let db: Database;
let userId = "alice";
let quotes: Quote[] = [];
vi.mock("@/server/db", () => ({ getDb: () => db }));
vi.mock("@/server/auth", () => ({ requireUser: async () => ({ id: userId }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/market", () => ({ getQuotes: async () => quotes }));
const client = new PGlite(),
  testDb = drizzle(client, { schema });
beforeAll(async () => {
  db = testDb as unknown as Database;
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await client.exec(await readFile(`drizzle/${file}`, "utf8"));
  await testDb.insert(schema.users).values([
    { id: "alice", name: "Alice", email: "alice@features.test" },
    { id: "bob", name: "Bob", email: "bob@features.test" },
  ]);
  await testDb.insert(schema.assets).values([
    { id: "USD", symbol: "USD", name: "Cash", providerId: "usd" },
    { id: "btc", symbol: "BTC", name: "Bitcoin", providerId: "bitcoin" },
    { id: "eth", symbol: "ETH", name: "Ethereum", providerId: "ethereum" },
  ]);
  await testDb
    .insert(schema.marketQuotes)
    .values({ assetId: "btc", price: "175", quotedAt: new Date() });
}, 60000);
afterAll(() => client.close());
function entry(portfolioId: string, extra = {}) {
  return {
    id: crypto.randomUUID(),
    portfolioId,
    assetId: "btc",
    kind: "deposit",
    quantity: "2",
    price: "100",
    fee: "0",
    occurredAt: "2026-01-01T00:00:00Z",
    notes: "",
    ...extra,
  };
}
async function portfolio(name: string) {
  userId = "alice";
  return portfolioService(db, userId).create({ name });
}
async function ledger(id: string) {
  return testDb
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.portfolioId, id));
}
describe("authorized transaction previews, atomic opening assets and quick undo", () => {
  it("previews each transaction kind without writing, with shared quotes", async () => {
    const p = await portfolio("Preview kinds"),
      service = portfolioService(db, "alice");
    await service.mutateTransaction(
      entry(p.id, { assetId: "USD", quantity: "1000", price: null }),
      "create",
      0,
    );
    await service.mutateTransaction(
      entry(p.id, { quantity: "5" }),
      "create",
      1,
    );
    for (const fields of [
      { kind: "buy", price: "50" },
      { kind: "sell", price: "150" },
      { kind: "deposit", price: null },
      { kind: "withdrawal", price: null },
      { kind: "fee", assetId: "USD", price: null },
      { kind: "airdrop", price: "10", airdropStatus: "received" },
    ]) {
      const result = await previewTransactionChange(
        p.id,
        2,
        "create",
        entry(p.id, {
          quantity: "1",
          occurredAt: "2026-02-01T00:00:00Z",
          ...fields,
        }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.impact.cash.before).toBe("1000");
      expect(await ledger(p.id)).toHaveLength(2);
    }
    const result = await previewTransactionChange(
      p.id,
      2,
      "create",
      entry(p.id, { kind: "buy", quantity: "1", price: "50" }),
    );
    expect(result).toMatchObject({
      ok: true,
      impact: {
        cash: { before: "1000", after: "950" },
        pnl: { before: "375", after: "500" },
      },
    });
  });
  it("previews a backdated edit and invalidates only affected snapshots on save", async () => {
    const p = await portfolio("Backdated edit"),
      service = portfolioService(db, "alice");
    const funding = entry(p.id, {
      assetId: "USD",
      quantity: "1000",
      price: null,
    });
    const purchase = entry(p.id, {
      kind: "buy",
      occurredAt: "2026-02-01T00:00:00Z",
    });
    await service.mutateTransaction(funding, "create", 0);
    await service.mutateTransaction(purchase, "create", 1);
    const correction = { ...purchase, price: "50" };
    expect(
      await previewTransactionChange(p.id, 2, "update", correction),
    ).toMatchObject({
      ok: true,
      impact: {
        cash: { before: "800", after: "900" },
        pnl: { before: "150", after: "250" },
      },
    });
    expect(
      await previewTransactionChange(p.id, 2, "update", {
        ...funding,
        quantity: "100",
      }),
    ).toMatchObject({ ok: false });
    expect(
      Number((await ledger(p.id)).find((r) => r.id === purchase.id)?.price),
    ).toBe(100);
    await testDb.insert(schema.snapshots).values([
      {
        portfolioId: p.id,
        day: "2026-01-02",
        capturedAt: new Date("2026-01-02T00:00:00Z"),
        value: "1000",
        cash: "1000",
        revision: 2,
      },
      {
        portfolioId: p.id,
        day: "2026-02-02",
        capturedAt: new Date("2026-02-02T00:00:00Z"),
        value: "1150",
        cash: "800",
        revision: 2,
      },
    ]);
    await service.mutateTransaction(correction, "update", 2);
    const remaining = await testDb
      .select()
      .from(schema.snapshots)
      .where(eq(schema.snapshots.portfolioId, p.id));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].capturedAt.toISOString()).toBe(
      "2026-01-02T00:00:00.000Z",
    );
  });
  it("keeps unknown basis distinct from known zero and preserves zero cash", async () => {
    const p = await portfolio("Opening batch"),
      rows = [
        entry(p.id, { price: null }),
        entry(p.id, { assetId: "eth", price: "0" }),
      ];
    const preview = await previewTransactionChange(p.id, 0, "batch", rows);
    expect(preview).toMatchObject({
      ok: true,
      impact: {
        cash: { before: "0", after: "0" },
        pnl: { after: null },
        complete: false,
      },
    });
    if (preview.ok)
      expect(preview.impact.assets.map((a) => a.basis.after)).toEqual([
        null,
        "0",
      ]);
    const saved = await saveOpeningAssets(rows, 0);
    expect(saved).toMatchObject({ ok: true, revision: 2 });
    expect((await ledger(p.id)).map((r) => r.sequence)).toEqual([1, 2]);
    expect(await saveOpeningAssets(rows, 0)).toMatchObject({ ok: true });
    expect(await ledger(p.id)).toHaveLength(2);
    await portfolioService(db, "alice").mutateTransaction(
      entry(p.id, { quantity: "1" }),
      "create",
      2,
    );
    expect((await ledger(p.id)).map((r) => r.sequence)).toEqual([1, 2, 3]);
  });
  it("rolls back the entire group for unknown/duplicate assets and stale revisions", async () => {
    const p = await portfolio("Atomic batch");
    for (const rows of [
      [entry(p.id), entry(p.id, { assetId: "missing" })],
      [entry(p.id), entry(p.id)],
    ]) {
      expect(await saveOpeningAssets(rows, 0)).toMatchObject({ ok: false });
      expect(await ledger(p.id)).toHaveLength(0);
    }
    expect(await saveOpeningAssets([entry(p.id)], 9)).toMatchObject({
      ok: false,
    });
    expect(
      await saveOpeningAssets(
        Array.from({ length: 21 }, () => entry(p.id)),
        0,
      ),
    ).toMatchObject({ ok: false });
  });
  it("blocks a deletion that would invalidate a later purchase", async () => {
    const p = await portfolio("Invalid deletion"),
      service = portfolioService(db, "alice"),
      cash = entry(p.id, { assetId: "USD", quantity: "1000", price: null });
    await service.mutateTransaction(cash, "create", 0);
    await service.mutateTransaction(
      entry(p.id, { kind: "buy", occurredAt: "2026-02-01T00:00:00Z" }),
      "create",
      1,
    );
    expect(
      await previewTransactionChange(p.id, 2, "delete", cash.id),
    ).toMatchObject({ ok: false });
    await expect(service.deleteTransaction(p.id, cash.id, 2)).rejects.toThrow();
    expect(await ledger(p.id)).toHaveLength(2);
  });
  it("restores the original row once, including after a compatible new transaction", async () => {
    const p = await portfolio("Undo"),
      service = portfolioService(db, "alice"),
      original = entry(p.id);
    await service.mutateTransaction(original, "create", 0);
    const originalRow = (await ledger(p.id))[0];
    const undo = await service.deleteTransaction(p.id, original.id, 1);
    await service.mutateTransaction(
      entry(p.id, { assetId: "USD", quantity: "10", price: null }),
      "create",
      2,
    );
    expect(await restoreTransaction(p.id, undo.undoId)).toMatchObject({
      ok: true,
    });
    expect(await restoreTransaction(p.id, undo.undoId)).toMatchObject({
      ok: true,
    });
    const rows = await ledger(p.id);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === original.id)?.sequence).toBe(1);
    expect(rows.find((r) => r.id === original.id)?.createdAt).toEqual(
      originalRow.createdAt,
    );
    expect(rows.find((r) => r.id === original.id)?.updatedAt).toEqual(
      originalRow.updatedAt,
    );
  });
  it("offers exactly thirty seconds and restores within the deadline", async () => {
    const p = await portfolio("Thirty-second undo"),
      service = portfolioService(db, "alice"),
      original = entry(p.id);
    await service.mutateTransaction(original, "create", 0);
    const undo = await service.deleteTransaction(p.id, original.id, 1);
    const [audit] = await testDb
      .select()
      .from(schema.audits)
      .where(eq(schema.audits.id, undo.undoId));
    expect(Date.parse(undo.expiresAt) - audit.createdAt.getTime()).toBe(30000);
    await testDb
      .update(schema.audits)
      .set({ createdAt: new Date(Date.now() - 25000) })
      .where(eq(schema.audits.id, undo.undoId));
    expect(await restoreTransaction(p.id, undo.undoId)).toMatchObject({
      ok: true,
    });
    expect(await ledger(p.id)).toHaveLength(1);
  });
  it("rejects expired undo and another user's previews, batch or restore", async () => {
    const p = await portfolio("Access"),
      service = portfolioService(db, "alice"),
      original = entry(p.id);
    await service.mutateTransaction(original, "create", 0);
    const undo = await service.deleteTransaction(p.id, original.id, 1);
    userId = "bob";
    expect(await restoreTransaction(p.id, undo.undoId)).toMatchObject({
      ok: false,
    });
    expect(await saveOpeningAssets([entry(p.id)], 2)).toMatchObject({
      ok: false,
    });
    expect(
      await previewTransactionChange(p.id, 2, "create", entry(p.id)),
    ).toMatchObject({ ok: false });
    userId = "alice";
    await testDb
      .update(schema.audits)
      .set({ createdAt: new Date(Date.now() - 31000) })
      .where(eq(schema.audits.id, undo.undoId));
    expect(await restoreTransaction(p.id, undo.undoId)).toMatchObject({
      ok: false,
    });
    expect(await ledger(p.id)).toHaveLength(0);
  });
  it("does not reuse a deleted high sequence from pre-existing history", async () => {
    const p = await portfolio("Sequence high water"),
      original = entry(p.id);
    await testDb.insert(schema.transactions).values({
      ...original,
      kind: "deposit",
      occurredAt: new Date(original.occurredAt),
      sequence: 100,
    });
    const service = portfolioService(db, "alice"),
      undo = await service.deleteTransaction(p.id, original.id, 0);
    await service.mutateTransaction(
      entry(p.id, { assetId: "USD", price: null }),
      "create",
      undo.revision,
    );
    expect((await ledger(p.id))[0].sequence).toBe(101);
    const restored = await restoreTransaction(p.id, undo.undoId);
    expect(restored, JSON.stringify(restored)).toMatchObject({ ok: true });
  });
  it("rejects undo when subsequent history is incompatible with the original date", async () => {
    const p = await portfolio("Incompatible undo"),
      service = portfolioService(db, "alice");
    await service.mutateTransaction(
      entry(p.id, { assetId: "USD", quantity: "100", price: null }),
      "create",
      0,
    );
    const withdrawal = entry(p.id, {
      kind: "withdrawal",
      assetId: "USD",
      quantity: "50",
      price: null,
      occurredAt: "2026-02-01T00:00:00Z",
    });
    await service.mutateTransaction(withdrawal, "create", 1);
    const undo = await service.deleteTransaction(p.id, withdrawal.id, 2);
    await service.mutateTransaction(
      entry(p.id, {
        kind: "buy",
        quantity: "1",
        price: "100",
        occurredAt: "2026-03-01T00:00:00Z",
      }),
      "create",
      3,
    );
    expect(await restoreTransaction(p.id, undo.undoId)).toMatchObject({
      ok: false,
    });
    expect(await ledger(p.id)).toHaveLength(2);
  });
});
describe("persisted Watchlist target episodes", () => {
  it("tracks buy and sell independently, ignores initial conditions and preserves each read state", async () => {
    const p = await portfolio("Two-sided targets"),
      service = watchlistService(db, "alice");
    await service.save({
      portfolioId: p.id,
      assetId: "eth",
      entryPrice: "0.5",
      exitPrice: "5",
      notes: "",
    });
    let timestamp = Date.now() - 10000;
    const check = async (price: string, stale = false) => {
      quotes = [
        {
          assetId: "eth",
          price,
          change24h: null,
          stale,
          updatedAt: new Date((timestamp += 1000)).toISOString(),
        },
      ];
      await evaluateWatchlistTargets(db, quotes, p.id);
      const reply = await loadTargetNotifications(p.id);
      if (!reply.ok) throw new Error(reply.error);
      return reply.rows;
    };
    expect(await check("1")).toHaveLength(0);
    expect(await check("4")).toHaveLength(0);
    const sell = await check("5");
    expect(sell).toHaveLength(1);
    expect(sell[0].side).toBe("sell");
    await readTargetNotification(p.id, sell[0].id, sell[0].reachedAt, "sell");
    const both = await check("0.5");
    expect(both).toHaveLength(2);
    expect(both.find((n) => n.side === "buy")?.readAt).toBeNull();
    expect(both.find((n) => n.side === "sell")?.readAt).not.toBeNull();
    const oldSell = both.find((n) => n.side === "sell")!.reachedAt;
    expect(
      (await check("5", true)).find((n) => n.side === "sell")?.reachedAt,
    ).toBe(oldSell);
    expect(
      (await check("5")).find((n) => n.side === "sell")?.readAt,
    ).toBeNull();
    await service.save({
      portfolioId: p.id,
      assetId: "eth",
      entryPrice: "0.5",
      exitPrice: "4",
      notes: "changed sell",
    });
    const reset = await check("5");
    expect(reset).toHaveLength(1);
    expect(reset[0].side).toBe("buy");
    // A target already satisfied at creation is baselined, including buy=5 at price=1.
    await service.save({
      portfolioId: p.id,
      assetId: "btc",
      entryPrice: "5",
      exitPrice: "5",
      notes: "",
    });
    quotes = [
      {
        assetId: "btc",
        price: "1",
        change24h: null,
        stale: false,
        updatedAt: new Date().toISOString(),
      },
    ];
    await evaluateWatchlistTargets(db, quotes, p.id);
    const noImmediate = await loadTargetNotifications(p.id);
    if (noImmediate.ok)
      expect(noImmediate.rows.filter((n) => n.assetId === "btc")).toHaveLength(
        0,
      );
  });
  it("notifies at the exact boundary, avoids duplicates, rearms above target and preserves reads", async () => {
    const p = await portfolio("Notifications"),
      service = watchlistService(db, "alice");
    await service.save({
      portfolioId: p.id,
      assetId: "btc",
      entryPrice: "100",
      notes: "",
    });
    const quote = (price: string, offset = 0, stale = false): Quote => ({
      assetId: "btc",
      price,
      change24h: null,
      updatedAt: new Date(Date.now() - 10000 + offset).toISOString(),
      stale,
    });
    quotes = [quote("110", -1000)];
    await evaluateWatchlistTargets(db, quotes, p.id);
    const baseline = await loadTargetNotifications(p.id);
    if (baseline.ok) expect(baseline.rows).toHaveLength(0);
    quotes = [quote("100")];
    await evaluateWatchlistTargets(db, quotes, p.id);
    const initial = await loadTargetNotifications(p.id);
    expect(initial.ok).toBe(true);
    if (!initial.ok) return;
    expect(initial.rows).toHaveLength(1);
    const notice = initial.rows[0];
    expect(
      await readTargetNotification(p.id, notice.id, notice.reachedAt),
    ).toMatchObject({ ok: true });
    quotes = [quote("99", 1000)];
    await evaluateWatchlistTargets(db, quotes, p.id);
    const read = await loadTargetNotifications(p.id);
    if (read.ok) {
      expect(read.rows[0].readAt).not.toBeNull();
      expect(read.rows[0].reachedAt).toBe(notice.reachedAt);
    }
    await evaluateWatchlistTargets(db, [quote("110", 2000, true)], p.id);
    await evaluateWatchlistTargets(db, [quote("98", 3000)], p.id);
    const stillRead = await loadTargetNotifications(p.id);
    if (stillRead.ok) expect(stillRead.rows[0].readAt).not.toBeNull();
    await evaluateWatchlistTargets(db, [quote("110", 4000)], p.id);
    quotes = [quote("90", 5000)];
    await evaluateWatchlistTargets(db, quotes, p.id);
    const repeated = await loadTargetNotifications(p.id);
    if (repeated.ok) {
      expect(repeated.rows[0].readAt).toBeNull();
      expect(Number(repeated.rows[0].price)).toBe(90);
    }
    userId = "bob";
    expect(
      await readTargetNotification(p.id, notice.id, notice.reachedAt),
    ).toMatchObject({ ok: false });
    expect(await loadTargetNotifications(p.id)).toMatchObject({ ok: false });
    userId = "alice";
    await service.save({
      portfolioId: p.id,
      assetId: "btc",
      entryPrice: "80",
      notes: "",
    });
    const reset = await loadTargetNotifications(p.id);
    if (reset.ok) expect(reset.rows).toHaveLength(0);
    await service.remove(p.id, notice.id);
    const removed = await loadTargetNotifications(p.id);
    if (removed.ok) expect(removed.rows).toHaveLength(0);
  });
});
