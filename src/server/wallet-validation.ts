import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { portfolioSchema } from "@/domain/validation";

function decodeBase32(value: string) {
  let bits = 0,
    acc = 0;
  const bytes: number[] = [];
  for (const char of value) {
    const digit = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(char);
    if (digit < 0) throw Error();
    acc = (acc << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >>> bits) & 255);
    }
  }
  if (bits && acc & ((1 << bits) - 1)) throw Error();
  return Uint8Array.from(bytes);
}
export function validStellarAddress(value: string) {
  if (!/^G[A-Z2-7]{55}$/.test(value)) return false;
  try {
    const b = decodeBase32(value);
    if (b.length !== 35 || b[0] !== 48) return false;
    let crc = 0;
    for (const n of b.slice(0, 33)) {
      crc ^= n << 8;
      for (let i = 0; i < 8; i++)
        crc = ((crc << 1) ^ (crc & 0x8000 ? 0x1021 : 0)) & 0xffff;
    }
    return b[33] === (crc & 255) && b[34] === crc >>> 8;
  } catch {
    return false;
  }
}
export function validBitcoinAddress(value: string) {
  if (value.length > 90) return false;
  try {
    if (/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(value)) {
      let n = 0n;
      for (const ch of value)
        n =
          n * 58n +
          BigInt(
            "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz".indexOf(
              ch,
            ),
          );
      let hex = n.toString(16);
      if (hex.length % 2) hex = "0" + hex;
      const b = Buffer.concat([
        Buffer.alloc(value.match(/^1*/)?.[0].length ?? 0),
        Buffer.from(hex, "hex"),
      ]);
      return (
        b.length === 25 &&
        (b[0] === 0 || b[0] === 5) &&
        createHash("sha256")
          .update(createHash("sha256").update(b.subarray(0, 21)).digest())
          .digest()
          .subarray(0, 4)
          .equals(b.subarray(21))
      );
    }
    if (value !== value.toLowerCase() && value !== value.toUpperCase())
      return false;
    const v = value.toLowerCase();
    if (!v.startsWith("bc1")) return false;
    const ds = [...v.slice(3)].map((c) =>
      "qpzry9x8gf2tvdw0s3jn54khce6mua7l".indexOf(c),
    );
    if (ds.length < 9 || ds.some((d) => d < 0)) return false;
    const hrp = [3, 3, 0, 2, 3];
    let chk = 1;
    const generators = [
      0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3,
    ];
    for (const d of [...hrp, ...ds]) {
      const top = chk >>> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ d;
      for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= generators[i];
    }
    const version = ds[0];
    if (version > 16 || chk !== (version === 0 ? 1 : 0x2bc830a3)) return false;
    let bits = 0,
      acc = 0;
    const bytes: number[] = [];
    for (const d of ds.slice(1, -6)) {
      acc = ((acc << 5) | d) & 0xfff;
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        bytes.push((acc >>> bits) & 255);
      }
    }
    return (
      bits < 5 &&
      (acc & ((1 << bits) - 1)) === 0 &&
      bytes.length >= 2 &&
      bytes.length <= 40 &&
      (version !== 0 || bytes.length === 20 || bytes.length === 32)
    );
  } catch {
    return false;
  }
}
export const walletInputSchema = portfolioSchema
  .extend({
    network: z.enum(["stellar", "bitcoin"]),
    addresses: z
      .array(z.string().trim().min(1).max(90))
      .min(1, "მიუთითეთ საჯარო მისამართი.")
      .max(10, "მაქსიმუმ 10 მისამართი."),
  })
  .superRefine((data, ctx) => {
    const normalized = data.addresses.map((a) =>
      data.network === "bitcoin" && /^bc1/i.test(a) ? a.toLowerCase() : a,
    );
    if (new Set(normalized).size !== normalized.length)
      ctx.addIssue({
        code: "custom",
        message: "მისამართი არ უნდა განმეორდეს.",
        path: ["addresses"],
      });
    data.addresses.forEach((a, i) => {
      if (
        !(data.network === "stellar"
          ? validStellarAddress(a)
          : validBitcoinAddress(a))
      )
        ctx.addIssue({
          code: "custom",
          message:
            data.network === "stellar"
              ? "შეიყვანეთ Stellar mainnet-ის საჯარო G… მისამართი."
              : "შეიყვანეთ Bitcoin mainnet-ის საჯარო მისამართი (1…, 3… ან bc1…).",
          path: ["addresses", i],
        });
    });
  });
