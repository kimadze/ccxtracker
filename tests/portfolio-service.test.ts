import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readdir, readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import type { Database } from "@/server/db";
import { portfolioService } from "@/server/services/portfolio";
import { scenarioService } from "@/server/services/scenarios";
import { allocationService } from "@/server/services/allocation";
import { strategyService } from "@/server/services/strategy";
import { watchlistService } from "@/server/services/watchlist";
import { runSnapshots } from "@/server/snapshots";

const client = new PGlite();
const testDb = drizzle(client, { schema });
// Both adapters implement the same tested PostgreSQL query/transaction methods.
const db = testDb as unknown as Database;
beforeAll(async () => {
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await client.exec(await readFile(`drizzle/${file}`, "utf8"));
  await testDb.insert(schema.users).values([
    { id: "alice", name: "Alice", email: "alice@example.test" },
    { id: "bob", name: "Bob", email: "bob@example.test" },
  ]);
  await testDb.insert(schema.assets).values([
    { id: "USD", symbol: "USD", name: "Cash", providerId: "usd" },
    { id: "btc", symbol: "BTC", name: "Bitcoin", providerId: "bitcoin" },
  ]);
}, 60000);
afterAll(async () => {
  await client.close();
});
function transaction(portfolioId: string, fields = {}) {
  return {
    id: crypto.randomUUID(),
    portfolioId,
    assetId: "USD",
    kind: "deposit",
    quantity: "1000",
    price: null,
    fee: "0",
    occurredAt: "2026-01-01T00:00:00Z",
    notes: "",
    ...fields,
  };
}
describe("protected portfolio service against real PostgreSQL semantics", () => {
  it("writes one daily snapshot and skips missing or stale valuations", async () => {
    const service = portfolioService(db, "alice"),
      p = await service.create({ name: "Snapshot test" });
    await service.mutateTransaction(
      transaction(p.id, { assetId: "btc", quantity: "1", price: "100" }),
      "create",
      0,
    );
    await runSnapshots({ db, loadQuotes: async () => [] });
    expect(
      await testDb
        .select()
        .from(schema.snapshots)
        .where(eq(schema.snapshots.portfolioId, p.id)),
    ).toHaveLength(0);
    const quote = {
      assetId: "btc",
      price: "150",
      change24h: null,
      updatedAt: new Date().toISOString(),
      stale: true,
    };
    await runSnapshots({ db, loadQuotes: async () => [quote] });
    expect(
      await testDb
        .select()
        .from(schema.snapshots)
        .where(eq(schema.snapshots.portfolioId, p.id)),
    ).toHaveLength(0);
    for (let i = 0; i < 2; i++)
      await runSnapshots({
        db,
        loadQuotes: async () => [{ ...quote, stale: false }],
      });
    const rows = await testDb
      .select()
      .from(schema.snapshots)
      .where(eq(schema.snapshots.portfolioId, p.id));
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].value)).toBe(150);
  });
  it("deletes an asset history atomically while retaining its journal", async () => {
    const service = portfolioService(db, "alice"),
      p = await service.create({ name: "Delete position" });
    await service.mutateTransaction(transaction(p.id), "create", 0);
    await service.mutateTransaction(
      transaction(p.id, {
        kind: "buy",
        assetId: "btc",
        quantity: "2",
        price: "100",
      }),
      "create",
      1,
    );
    await strategyService(db, "alice").saveJournal({
      portfolioId: p.id,
      assetId: "btc",
      thesis: "Retained",
      entryReason: "",
      catalysts: "",
      invalidation: "",
      targets: "",
      conviction: "medium",
      horizon: "",
      notes: "",
    });
    await expect(
      portfolioService(db, "bob").deletePosition(p.id, "btc", 2),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    await service.deletePosition(p.id, "btc", 2);
    expect(await service.entries(p.id)).toHaveLength(1);
    expect((await service.owned(p.id)).revision).toBe(3);
    expect((await strategyService(db, "alice").journalAssets(p.id))[0].id).toBe(
      "btc",
    );
    expect(
      (await strategyService(db, "alice").load(p.id, "btc")).journal?.thesis,
    ).toBe("Retained");
  });
  it("validates scenario CRUD and denies foreign nested scenario mutation", async () => {
    const p = await portfolioService(db, "alice").create({
      name: "Scenario tests",
    });
    const own = scenarioService(db, "alice"),
      other = scenarioService(db, "bob");
    const input = {
      id: crypto.randomUUID(),
      portfolioId: p.id,
      name: "Growth",
      prices: [{ assetId: "btc", price: "150" }],
    };
    await own.save(input, "create");
    expect((await own.list(p.id)).scenarios[0].prices.btc).toMatch(/^150/);
    await expect(other.list(p.id)).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(other.save(input, "update")).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
    const bobPortfolio = await portfolioService(db, "bob").create({
      name: "Bob scenario",
    });
    await expect(
      other.save({ ...input, portfolioId: bobPortfolio.id }, "update"),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    await own.save({ ...input, name: "Updated" }, "update");
    await own.goal({ portfolioId: p.id, target: "1000", milestones: ["500"] });
    expect((await own.list(p.id)).goal?.milestones).toEqual(["500"]);
    await own.remove(p.id, input.id);
    expect((await own.list(p.id)).scenarios).toHaveLength(0);
  });
  it("keeps watchlist independent of holdings and protects plans and journals", async () => {
    const service = portfolioService(db, "alice"),
      p = await service.create({ name: "Planning" });
    await watchlistService(db, "alice").save({
      portfolioId: p.id,
      assetId: "btc",
      entryPrice: "90",
      notes: "Watch",
    });
    expect(await service.entries(p.id)).toHaveLength(0);
    expect(await watchlistService(db, "alice").list(p.id)).toHaveLength(1);
    await expect(watchlistService(db, "bob").list(p.id)).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
    await service.mutateTransaction(
      transaction(p.id, { assetId: "btc", quantity: "10", price: "100" }),
      "create",
      0,
    );
    await strategyService(db, "alice").saveExit({
      portfolioId: p.id,
      assetId: "btc",
      feePercent: "1",
      levels: [{ price: "200", percentage: "50" }],
    });
    const journal = {
      portfolioId: p.id,
      assetId: "btc",
      thesis: "Thesis",
      entryReason: "",
      catalysts: "",
      invalidation: "",
      targets: "",
      conviction: "medium",
      horizon: "",
      notes: "",
    };
    await strategyService(db, "alice").saveJournal(journal);
    expect(
      (await strategyService(db, "alice").load(p.id, "btc")).journal?.thesis,
    ).toBe("Thesis");
    await expect(
      strategyService(db, "bob").saveJournal(journal),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(strategyService(db, "bob").load(p.id, "btc")).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
    await allocationService(db, "alice").save({
      portfolioId: p.id,
      rows: [
        { assetId: "btc", weight: "80" },
        { assetId: "USD", weight: "20" },
      ],
    });
    await expect(allocationService(db, "bob").list(p.id)).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
    await expect(
      allocationService(db, "alice").save({
        portfolioId: p.id,
        rows: [{ assetId: "btc", weight: "80" }],
      }),
    ).rejects.toThrow("INVALID_ALLOCATION");
    expect(await allocationService(db, "alice").list(p.id)).toHaveLength(2);
  });
  it("invalidates historical snapshots after backdated correction", async () => {
    const service = portfolioService(db, "alice"),
      p = await service.create({ name: "History" });
    const funding = transaction(p.id);
    await service.mutateTransaction(funding, "create", 0);
    await testDb.insert(schema.snapshots).values({
      portfolioId: p.id,
      day: "2026-02-01",
      capturedAt: new Date("2026-02-01"),
      value: "1000",
      cash: "1000",
      revision: 1,
    });
    await service.mutateTransaction(
      { ...funding, quantity: "1200" },
      "update",
      1,
    );
    expect(
      await testDb
        .select()
        .from(schema.snapshots)
        .where(eq(schema.snapshots.portfolioId, p.id)),
    ).toHaveLength(0);
  });
  it("serializes 50 competing edits without silently overwriting the ledger", async () => {
    const service = portfolioService(db, "alice"),
      p = await service.create({ name: "Concurrent submissions" });
    const results = await Promise.allSettled(
      Array.from({ length: 50 }, () =>
        service.mutateTransaction(transaction(p.id), "create", 0),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await service.entries(p.id)).toHaveLength(1);
    expect((await service.owned(p.id)).revision).toBe(1);
  });
  it("denies missing identity and cross-user reads, updates and deletes", async () => {
    expect(() => portfolioService(db, "")).toThrow();
    const alice = portfolioService(db, "alice"),
      bob = portfolioService(db, "bob");
    const p = await alice.create({ name: "Private" });
    expect((await bob.list()).some((portfolio) => portfolio.id === p.id)).toBe(
      false,
    );
    await expect(bob.owned(p.id)).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(bob.entries(p.id)).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(bob.rename(p.id, { name: "Hijack" })).rejects.toThrow(
      "RESOURCE_NOT_FOUND",
    );
    await expect(bob.remove(p.id)).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(
      bob.mutateTransaction(transaction(p.id), "create", 0),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(
      bob.deleteTransaction(p.id, crypto.randomUUID(), 0),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
  });
  it("commits valid ledger changes, blocks stale submissions and is idempotent", async () => {
    const service = portfolioService(db, "alice"),
      p = await service.create({ name: "Ledger" });
    const funding = transaction(p.id);
    await service.mutateTransaction(funding, "create", 0);
    await service.mutateTransaction(funding, "create", 0);
    expect(await service.entries(p.id)).toHaveLength(1);
    await expect(
      service.mutateTransaction(transaction(p.id), "create", 0),
    ).rejects.toThrow("STALE_REVISION");
    await service.mutateTransaction(
      transaction(p.id, {
        kind: "buy",
        assetId: "btc",
        quantity: "2",
        price: "100",
      }),
      "create",
      1,
    );
    const [position] = await testDb
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.portfolioId, p.id));
    expect(Number(position.costBasis)).toBe(200);
    await expect(
      service.deleteTransaction(p.id, funding.id, 2),
    ).rejects.toThrow("INSUFFICIENT_CASH");
    expect(await service.entries(p.id)).toHaveLength(2);
    expect((await service.owned(p.id)).revision).toBe(2);
  });
  it("cannot mutate a nested transaction from a different portfolio", async () => {
    const service = portfolioService(db, "alice");
    const p1 = await service.create({ name: "First" }),
      p2 = await service.create({ name: "Second" });
    const funding = transaction(p1.id);
    await service.mutateTransaction(funding, "create", 0);
    await expect(
      service.mutateTransaction(
        { ...funding, portfolioId: p2.id },
        "update",
        0,
      ),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(
      service.deleteTransaction(p2.id, funding.id, 0),
    ).rejects.toThrow("RESOURCE_NOT_FOUND");
  });
  it("records correction audit and recomputes projections", async () => {
    const service = portfolioService(db, "alice"),
      p = await service.create({ name: "Correction" });
    const deposit = transaction(p.id, {
      assetId: "btc",
      quantity: "2",
      price: "100",
    });
    await service.mutateTransaction(deposit, "create", 0);
    await service.mutateTransaction({ ...deposit, price: "120" }, "update", 1);
    const [position] = await testDb
      .select()
      .from(schema.positions)
      .where(eq(schema.positions.portfolioId, p.id));
    expect(Number(position.costBasis)).toBe(240);
    const records = await testDb
      .select()
      .from(schema.audits)
      .where(eq(schema.audits.portfolioId, p.id));
    expect(records).toHaveLength(1);
  });
});
