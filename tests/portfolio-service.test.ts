import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readdir, readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import type { Database } from "@/server/db";
import { portfolioService } from "@/server/services/portfolio";

const client = new PGlite();
const testDb = drizzle(client, { schema });
// Both adapters implement the same tested PostgreSQL query/transaction methods.
const db = testDb as unknown as Database;
beforeAll(async () => {
  for (const file of (await readdir("drizzle")).filter(f => f.endsWith(".sql")).sort()) await client.exec(await readFile(`drizzle/${file}`, "utf8"));
  await testDb.insert(schema.users).values([{ id: "alice", name: "Alice", email: "alice@example.test" }, { id: "bob", name: "Bob", email: "bob@example.test" }]);
  await testDb.insert(schema.assets).values([{ id: "USD", symbol: "USD", name: "Cash", providerId: "usd" }, { id: "btc", symbol: "BTC", name: "Bitcoin", providerId: "bitcoin" }]);
}, 60000);
afterAll(async () => { await client.close(); });
function transaction(portfolioId: string, fields = {}) { return { id: crypto.randomUUID(), portfolioId, assetId: "USD", kind: "deposit", quantity: "1000", price: null, fee: "0", occurredAt: "2026-01-01T00:00:00Z", notes: "", ...fields }; }
describe("protected portfolio service against real PostgreSQL semantics", () => {
  it("denies missing identity and cross-user reads, updates and deletes", async () => {
    expect(() => portfolioService(db, "")).toThrow();
    const alice = portfolioService(db, "alice"), bob = portfolioService(db, "bob");
    const p = await alice.create({ name: "Private" });
    expect(await bob.list()).toHaveLength(0);
    await expect(bob.owned(p.id)).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(bob.entries(p.id)).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(bob.rename(p.id, { name: "Hijack" })).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(bob.remove(p.id)).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(bob.mutateTransaction(transaction(p.id), "create", 0)).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(bob.deleteTransaction(p.id, crypto.randomUUID(), 0)).rejects.toThrow("RESOURCE_NOT_FOUND");
  });
  it("commits valid ledger changes, blocks stale submissions and is idempotent", async () => {
    const service = portfolioService(db, "alice"), p = await service.create({ name: "Ledger" });
    const funding = transaction(p.id);
    await service.mutateTransaction(funding, "create", 0);
    await service.mutateTransaction(funding, "create", 0);
    expect(await service.entries(p.id)).toHaveLength(1);
    await expect(service.mutateTransaction(transaction(p.id), "create", 0)).rejects.toThrow("STALE_REVISION");
    await service.mutateTransaction(transaction(p.id, { kind: "buy", assetId: "btc", quantity: "2", price: "100" }), "create", 1);
    const [position] = await testDb.select().from(schema.positions).where(eq(schema.positions.portfolioId, p.id));
    expect(Number(position.costBasis)).toBe(200);
    await expect(service.deleteTransaction(p.id, funding.id, 2)).rejects.toThrow("INSUFFICIENT_CASH");
    expect(await service.entries(p.id)).toHaveLength(2);
    expect((await service.owned(p.id)).revision).toBe(2);
  });
  it("cannot mutate a nested transaction from a different portfolio", async () => {
    const service = portfolioService(db, "alice");
    const p1 = await service.create({ name: "First" }), p2 = await service.create({ name: "Second" });
    const funding = transaction(p1.id); await service.mutateTransaction(funding, "create", 0);
    await expect(service.mutateTransaction({ ...funding, portfolioId: p2.id }, "update", 0)).rejects.toThrow("RESOURCE_NOT_FOUND");
    await expect(service.deleteTransaction(p2.id, funding.id, 0)).rejects.toThrow("RESOURCE_NOT_FOUND");
  });
  it("records correction audit and recomputes projections", async () => {
    const service = portfolioService(db, "alice"), p = await service.create({ name: "Correction" });
    const deposit = transaction(p.id, { assetId: "btc", quantity: "2", price: "100" });
    await service.mutateTransaction(deposit, "create", 0);
    await service.mutateTransaction({ ...deposit, price: "120" }, "update", 1);
    const [position] = await testDb.select().from(schema.positions).where(eq(schema.positions.portfolioId, p.id));
    expect(Number(position.costBasis)).toBe(240);
    const records = await testDb.select().from(schema.audits).where(eq(schema.audits.portfolioId, p.id));
    expect(records).toHaveLength(1);
  });
});
