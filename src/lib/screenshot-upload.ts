export const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
/** Local resize keeps the multipart request below the hosting upload limit. */
export async function prepareScreenshotUpload(file: File) {
  if (
    !file.size ||
    file.size > SCREENSHOT_MAX_BYTES ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  )
    throw new Error("აირჩიე PNG, JPEG ან WebP სურათი, მაქსიმუმ 5MB.");
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...header.slice(start, end));
  const valid =
    file.type === "image/png"
      ? header.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
      : file.type === "image/jpeg"
        ? header[0] === 255 && header[1] === 216 && header[2] === 255
        : ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  if (!valid)
    throw new Error("სურათი დაზიანებულია ან ფორმატი არ შეესაბამება ფაილს.");
  const bitmap = await createImageBitmap(file);
  try {
    if (
      bitmap.width * bitmap.height > 25000000 ||
      bitmap.width > 12000 ||
      bitmap.height > 12000
    )
      throw new Error("სურათი ძალიან დიდია. ამოჭერი მხოლოდ ტრანზაქცია.");
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("სურათის დამუშავება ვერ შესრულდა.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob || blob.size > 3 * 1024 * 1024)
      throw new Error("ამოჭერი მხოლოდ ტრანზაქცია და სცადე ხელახლა.");
    return new File([blob], "transaction.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
