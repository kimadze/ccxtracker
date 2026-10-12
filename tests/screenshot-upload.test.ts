import { afterEach, expect, it, vi } from "vitest";
import { prepareScreenshotUpload } from "@/lib/screenshot-upload";
afterEach(() => vi.unstubAllGlobals());
it("rejects forged image types before browser decoding", async () => {
  const decoder = vi.fn();
  vi.stubGlobal("createImageBitmap", decoder);
  await expect(
    prepareScreenshotUpload(
      new File(["not PNG"], "trade.png", { type: "image/png" }),
    ),
  ).rejects.toThrow();
  expect(decoder).not.toHaveBeenCalled();
});
it("rejects original files over 5MB before decoding", async () => {
  const decoder = vi.fn();
  vi.stubGlobal("createImageBitmap", decoder);
  await expect(
    prepareScreenshotUpload(
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "trade.png", {
        type: "image/png",
      }),
    ),
  ).rejects.toThrow();
  expect(decoder).not.toHaveBeenCalled();
});
it("normalizes within hosting limits and closes local image resources", async () => {
  const close = vi.fn();
  vi.stubGlobal("createImageBitmap", async () => ({
    width: 4000,
    height: 2000,
    close,
  }));
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    }),
    toBlob: (done: (blob: Blob) => void) =>
      done(new Blob(["jpeg"], { type: "image/jpeg" })),
  };
  vi.stubGlobal("document", { createElement: () => canvas });
  const file = new File(
    [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
    "fixture.png",
    { type: "image/png" },
  );
  expect((await prepareScreenshotUpload(file)).type).toBe("image/jpeg");
  expect(canvas.width).toBe(2048);
  expect(canvas.height).toBe(1024);
  expect(close).toHaveBeenCalledTimes(1);
});
