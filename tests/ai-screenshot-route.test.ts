import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ai/transaction-screenshot/route";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  allowed: vi.fn(),
  parse: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/server/ai/screenshot", () => ({
  MAX_SCREENSHOT_BYTES: 5 * 1024 * 1024,
  screenshotAllowed: mocks.allowed,
  parseScreenshot: mocks.parse,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "owner" });
  mocks.allowed.mockReturnValue(true);
  mocks.parse.mockResolvedValue({ ok: true });
});
it("rejects anonymous and other accounts before reading the image", async () => {
  mocks.user.mockResolvedValueOnce(null);
  expect((await POST(new Request("https://app.test/api"))).status).toBe(401);
  mocks.allowed.mockReturnValue(false);
  expect((await POST(new Request("https://app.test/api"))).status).toBe(403);
  expect(mocks.parse).not.toHaveBeenCalled();
});
it("rejects cross-origin requests", async () => {
  expect(
    (
      await POST(
        new Request("https://app.test/api", {
          headers: { origin: "https://evil.test" },
        }),
      )
    ).status,
  ).toBe(403);
  expect(mocks.parse).not.toHaveBeenCalled();
});
it("bounds streamed uploads even without Content-Length", async () => {
  const req = new Request("https://app.test/api", {
    method: "POST",
    headers: {
      origin: "https://app.test",
      "content-type": "multipart/form-data; boundary=a",
    },
    body: new Uint8Array(5 * 1024 * 1024 + 20000),
  });
  expect((await POST(req)).status).toBe(413);
  expect(mocks.parse).not.toHaveBeenCalled();
});
it("accepts same-origin multipart and disables response caching", async () => {
  const form = new FormData();
  form.set("image", new File(["fixture"], "trade.png"));
  const res = await POST(
    new Request("https://app.test/api", {
      method: "POST",
      headers: { origin: "https://app.test" },
      body: form,
    }),
  );
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ ok: true });
  expect(mocks.parse).toHaveBeenCalledTimes(1);
});
