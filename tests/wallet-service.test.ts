import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readdir, readFile } from "node:fs/promises";
import { eq, sql } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import type { Database } from "@/server/db";
import { walletService } from "@/server/services/wallet";
import type { WalletSnapshot } from "@/domain/wallet";
const client = new PGlite();
const database = drizzle(client, { schema });
const db = database as unknown as Database;
const input = {
  name: "BTC wallet",
  network: "bitcoin",
  addresses: ["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"],
};
const snapshot: WalletSnapshot = {
  accounts: [],
  fetchedAt: new Date().toISOString(),
  priceAt: null,
  knownValue: "42",
  complete: true,
};
beforeAll(async () => {
  for (const f of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await client.exec(await readFile(`drizzle/${f}`, "utf8"));
  await database.insert(schema.users).values([
    { id: "alice", name: "a", email: "a@t.test" },
    { id: "bob", name: "b", email: "b@t.test" },
  ]);
}, 60000);
afterAll(() => client.close());
it("refreshes a newly created wallet with PostgreSQL microsecond timestamps", async () => {
  const service = walletService(db, "alice", async () => snapshot);
  const p = await service.create(input);
  await database
    .update(schema.walletPortfolios)
    .set({
      updatedAt: sql`'2026-10-03T12:00:00.123456Z'::timestamptz`,
    })
    .where(eq(schema.walletPortfolios.id, p.id));
  await service.refresh(p.id);
  expect((await service.owned(p.id)).snapshot?.knownValue).toBe("42");
  await expect(service.refresh(p.id)).rejects.toThrow("WALLET_REFRESH_LIMIT");
});
it("isolates wallets by owner and rejects wrong-chain keys", async () => {
  const service = walletService(db, "alice", async () => snapshot);
  const p = await service.create(input);
  await expect(walletService(db, "bob").owned(p.id)).rejects.toThrow(
    "RESOURCE_NOT_FOUND",
  );
  await expect(walletService(db, "bob").refresh(p.id)).rejects.toThrow(
    "RESOURCE_NOT_FOUND",
  );
  expect(await walletService(db, "bob").list()).toHaveLength(0);
  await expect(
    service.create({ ...input, addresses: ["secret-key"] }),
  ).rejects.toThrow();
  await service.refresh(p.id);
  expect((await service.owned(p.id)).snapshot?.knownValue).toBe("42");
  await expect(service.refresh(p.id)).rejects.toThrow("WALLET_REFRESH_LIMIT");
  await service.remove(p.id);
  await expect(service.owned(p.id)).rejects.toThrow();
});
it("preserves the last good snapshot after failure and invalidates it on address edits", async () => {
  const service = walletService(db, "alice", async () => snapshot);
  const p = await service.create(input);
  await service.refresh(p.id);
  await database
    .update(schema.walletPortfolios)
    .set({ lastAttemptAt: new Date(0) })
    .where(eq(schema.walletPortfolios.id, p.id));
  await expect(
    walletService(db, "alice", async () => {
      throw Error("WALLET_PROVIDER_FAILED");
    }).refresh(p.id),
  ).rejects.toThrow();
  const saved = await service.owned(p.id);
  expect(saved.snapshot?.knownValue).toBe("42");
  expect(saved.lastError).not.toBeNull();
  await service.update(p.id, { ...input, name: "new" });
  expect((await service.owned(p.id)).snapshot).toBeNull();
});
it("cannot let a refresh overwrite settings edited during the provider request", async () => {
  const service = walletService(db, "alice", async () => snapshot);
  const p = await service.create(input);
  const race = walletService(db, "alice", async () => {
    await service.update(p.id, { ...input, name: "edited" });
    return snapshot;
  });
  await race.refresh(p.id);
  const saved = await service.owned(p.id);
  expect(saved.name).toBe("edited");
  expect(saved.snapshot).toBeNull();
});
