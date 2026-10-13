import { test, expect } from "@playwright/test";
import sharp from "sharp";

test("PWA icons are available at declared sizes with Apple support and maskable safe area", async ({
  page,
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(
    manifest.icons.filter((i: { purpose: string }) => i.purpose === "any"),
  ).toHaveLength(3);
  expect(
    manifest.icons.filter((i: { purpose: string }) => i.purpose === "maskable"),
  ).toHaveLength(2);
  for (const icon of manifest.icons) {
    const image = await request.get(icon.src);
    expect(image.ok()).toBe(true);
    const bytes = await image.body(),
      metadata = await sharp(bytes).metadata();
    expect(`${metadata.width}x${metadata.height}`).toBe(icon.sizes);
    if (icon.purpose === "maskable") {
      const { data, info } = await sharp(bytes)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const center = (info.width - 1) / 2,
        safe = info.width * 0.4;
      let maximumRadius = 0;
      for (let y = 0; y < info.height; y++)
        for (let x = 0; x < info.width; x++) {
          const p = (y * info.width + x) * 4;
          if (
            Math.max(
              Math.abs(data[p] - 12),
              Math.abs(data[p + 1] - 13),
              Math.abs(data[p + 2] - 18),
            ) > 20
          )
            maximumRadius = Math.max(
              maximumRadius,
              Math.hypot(x - center, y - center),
            );
        }
      expect(maximumRadius).toBeLessThanOrEqual(safe);
    }
  }
  await page.goto("/login");
  const apple = page.locator('link[rel="apple-touch-icon"]');
  await expect(apple).toHaveAttribute("href", "/icons/ccx-apple-180-v3.png");
  expect(
    (
      await sharp(
        await (await request.get("/icons/ccx-apple-180-v3.png")).body(),
      ).metadata()
    ).width,
  ).toBe(180);
  const favicon = await request.get("/icon.svg");
  expect(favicon.ok()).toBe(true);
  expect(await favicon.text()).not.toContain("<image");
});
