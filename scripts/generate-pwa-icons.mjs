import sharp from "sharp";
import { readFile, copyFile } from "node:fs/promises";
const svg = await readFile("public/icons/ccx-mark-v3.svg");
// A self-contained vector master avoids raster stretching and external SVG image references.
await copyFile("public/icons/ccx-mark-v3.svg", "src/app/icon.svg");
for (const size of [192, 512, 1024]) {
  const mark = await sharp(svg)
    .resize(Math.round(size * 0.9), Math.round(size * 0.9))
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(`public/icons/ccx-${size}-v3.png`);
}
for (const size of [192, 512]) {
  const mark = await sharp(svg)
    .resize(Math.round(size * 0.72), Math.round(size * 0.72))
    .png()
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: "#0c0d12" },
  })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(`public/icons/ccx-maskable-${size}-v3.png`);
}
const appleMark = await sharp(svg).resize(162, 162).png().toBuffer();
await sharp({
  create: { width: 180, height: 180, channels: 4, background: "#0c0d12" },
})
  .composite([{ input: appleMark, gravity: "centre" }])
  .png()
  .toFile("public/icons/ccx-apple-180-v3.png");
console.log(
  "Generated transparent, maskable and Apple icons from the vector master.",
);
