import type { Locator } from "@playwright/test";

export async function chooseAsset(
  container: Locator,
  assetId: string,
  label = "აქტივი",
) {
  const control = container.getByLabel(label, { exact: true });
  if (await control.evaluate((element) => element.tagName === "SELECT")) {
    await control.selectOption(assetId);
    return;
  }
  await control.click();
  const chooser = container.getByRole("region", {
    name: `${label} — არჩევა`,
    exact: true,
  });
  await chooser
    .getByRole("textbox", { name: `${label} — ძიება`, exact: true })
    .fill(assetId);
  await chooser.locator(`[data-asset-result="${assetId}"]`).click();
}
