import { beforeAll, beforeEach, afterAll, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFile, readdir } from "node:fs/promises";
import * as schema from "@/server/db/schema";
import type { Database } from "@/server/db";
import { adminService } from "@/server/admin";
import { isAdmin } from "@/server/admin-access";
import { aiPolicy } from "@/server/ai/policy";
import { lunaJson } from "@/server/ai/client";
const client = new PGlite(),
  testDb = drizzle(client, { schema }),
  db = testDb as unknown as Database;
vi.mock("@/server/db", () => ({ getDb: () => db }));
const actor = { id: "admin", email: "admin@example.test", emailVerified: true };
beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", actor.email);
  vi.stubEnv("OPENAI_API_KEY", "test-only");
  for (const file of (await readdir("drizzle"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await client.exec(await readFile(`drizzle/${file}`, "utf8"));
  await testDb.insert(schema.users).values([
    { ...actor, name: "Admin" },
    {
      id: "member",
      email: "member@example.test",
      name: "Member",
      emailVerified: true,
    },
  ]);
}, 60000);
beforeEach(async () => {
  await testDb.delete(schema.adminEvents);
  await testDb.delete(schema.adminControls);
  await testDb.delete(schema.suspendedUsers);
  await testDb.delete(schema.aiUsage);
  await testDb.delete(schema.sessions);
});
afterAll(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await client.close();
});
it("denies access without a verified allowlisted identity, including when configuration is empty", () => {
  expect(isAdmin({ ...actor, emailVerified: false })).toBe(false);
  expect(() =>
    adminService(db, { ...actor, email: "other@example.test" }),
  ).toThrow("ADMIN_FORBIDDEN");
  vi.stubEnv("ADMIN_EMAILS", "");
  expect(isAdmin(actor)).toBe(false);
  vi.stubEnv("ADMIN_EMAILS", actor.email);
});
it("applies bounded AI controls atomically with an administrative event", async () => {
  expect(await aiPolicy()).toMatchObject({
    aiEnabled: true,
    userDailyLimit: 20,
  });
  await adminService(db, actor).controls({
    aiEnabled: false,
    userDailyLimit: 5,
    globalDailyLimit: 50,
  });
  expect(await aiPolicy()).toMatchObject({
    aiEnabled: false,
    userDailyLimit: 5,
    globalDailyLimit: 50,
  });
  expect(await testDb.select().from(schema.adminEvents)).toHaveLength(1);
  await expect(
    adminService(db, actor).controls({
      aiEnabled: true,
      userDailyLimit: 0,
      globalDailyLimit: 999999,
    }),
  ).rejects.toThrow();
  expect(await testDb.select().from(schema.adminEvents)).toHaveLength(1);
});
it("suspends a member, removes sessions, restores access and protects admins", async () => {
  await testDb.insert(schema.sessions).values({
    id: "session",
    token: "dummy",
    userId: "member",
    expiresAt: new Date(Date.now() + 60000),
  });
  const service = adminService(db, actor);
  await service.suspend({ userId: "member", suspended: true });
  expect(await testDb.select().from(schema.sessions)).toHaveLength(0);
  expect(await testDb.select().from(schema.suspendedUsers)).toHaveLength(1);
  await service.suspend({ userId: "member", suspended: false });
  expect(await testDb.select().from(schema.suspendedUsers)).toHaveLength(0);
  await expect(
    service.suspend({ userId: "admin", suspended: true }),
  ).rejects.toThrow();
});
it("records usage and cached token cost without storing prompts, images or keys", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: "completed",
            usage: {
              input_tokens: 1000,
              output_tokens: 100,
              input_tokens_details: { cached_tokens: 500 },
            },
            output: [
              { content: [{ type: "output_text", text: '{"ok":true}' }] },
            ],
          }),
        ),
    ),
  );
  await lunaJson("sensitive prompt", { text: "private trade" }, {}, undefined, {
    userId: "admin",
    feature: "text",
  });
  const [usage] = await testDb.select().from(schema.aiUsage);
  expect(Number(usage.estimatedCost)).toBeCloseTo(0.000105, 10);
  expect(JSON.stringify(usage)).not.toMatch(
    /private trade|sensitive prompt|test-only/,
  );
  expect(usage.status).toBe("success");
});
it("records unknown provider costs as unknown instead of zero", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 500 })),
  );
  await expect(
    lunaJson("x", {}, {}, undefined, { userId: "admin", feature: "text" }),
  ).rejects.toThrow();
  const [usage] = await testDb.select().from(schema.aiUsage);
  expect(usage.estimatedCost).toBeNull();
  expect(usage.status).toBe("failed");
});
it("does not retry sent, cancelled or expired reports; accepted retry only queues work", async () => {
  const [portfolio] = await testDb
    .insert(schema.portfolios)
    .values({ userId: "member", name: "Private" })
    .returning();
  await testDb
    .insert(schema.telegramConnections)
    .values({ userId: "member", chatId: "dummy" });
  const [connection] = await testDb.select().from(schema.telegramConnections);
  const [job] = await testDb
    .insert(schema.telegramDigests)
    .values({
      userId: "member",
      generation: connection.generation,
      day: "2026-10-13",
      portfolioIds: [portfolio.id],
      attempts: 5,
      lastError: "DELIVERY_FAILED",
    })
    .returning();
  await adminService(db, actor).retry({ kind: "digest", id: job.id });
  const [queued] = await testDb.select().from(schema.telegramDigests);
  expect(queued.attempts).toBe(0);
  expect(queued.sentAt).toBeNull();
  expect((await adminService(db, actor).notifications())[0]).not.toHaveProperty(
    "body",
  );
  for (const patch of [
    { sentAt: new Date() },
    { lastError: "CANCELLED" },
    { lastError: "BOT_BLOCKED" },
    { createdAt: new Date(Date.now() - 7 * 3600000) },
    { nextAttemptAt: new Date(Date.now() + 60000) },
  ]) {
    await testDb.update(schema.telegramDigests).set({
      attempts: 5,
      sentAt: null,
      lastError: "DELIVERY_FAILED",
      createdAt: new Date(),
      nextAttemptAt: new Date(Date.now() - 1000),
      ...patch,
    });
    await expect(
      adminService(db, actor).retry({ kind: "digest", id: job.id }),
    ).rejects.toThrow("RETRY_UNAVAILABLE");
  }
  expect(await testDb.select().from(schema.adminEvents)).toHaveLength(1);
});
