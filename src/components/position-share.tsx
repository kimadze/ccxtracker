"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eye, EyeOff, Share2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import QRCode from "qrcode";
import type { ValuedPosition } from "@/domain/types";
import { money, percentage } from "@/lib/formatters";
import { highResLogoUrl } from "@/lib/asset-logo";

type ShareTemplate = "performance" | "reaction" | "mood";
const templateStorageKey = "ccx-position-share-template";

const loadImage = (src: string, timeoutMs = 1800) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(
      () => reject(new Error("IMAGE_TIMEOUT")),
      timeoutMs,
    );
    image.crossOrigin = "anonymous";
    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(image);
    };
    image.onerror = (error) => {
      window.clearTimeout(timeout);
      reject(error);
    };
    image.src = src;
  });

function line(
  context: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 1,
) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.strokeStyle = color;
  context.lineWidth = width;
  context.stroke();
}
function panel(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, 18);
  context.fillStyle = "rgba(7,12,32,.74)";
  context.fill();
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.stroke();
}

export function PositionShare({
  position,
  compact = false,
}: {
  position: ValuedPosition;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [hideAmounts, setHideAmounts] = useState(false),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState(""),
    [template, setTemplate] = useState<ShareTemplate>("performance");
  const canvas = useRef<HTMLCanvasElement>(null);
  const sharedImage = useRef<Blob | null>(null);
  const renderVersion = useRef(0);
  const positive =
    position.unrealizedPnl !== null && Number(position.unrealizedPnl) >= 0;
  const render = useCallback(async () => {
    const preview = canvas.current;
    if (!preview) return;
    const version = ++renderVersion.current;
    sharedImage.current = null;
    setReady(false);
    await document.fonts.ready;
    const target = document.createElement("canvas");
    const publish = (image: Blob | null) => {
      if (version !== renderVersion.current) return;
      preview.width = target.width;
      preview.height = target.height;
      preview.getContext("2d")?.drawImage(target, 0, 0);
      sharedImage.current = image;
      setReady(image !== null);
      setStatus(image ? "" : "სურათის მომზადება ვერ მოხერხდა.");
    };
    const context = target.getContext("2d");
    if (!context) return;
    const W = 1080,
      H = 1080;
    target.width = W;
    target.height = H;
    const resultColor = positive ? "#46eeb2" : "#ff668b";
    if (template === "mood") {
      const artwork = await loadImage(
        positive
          ? "/position-share-scene-profit.webp"
          : "/position-share-scene-loss.webp",
        12000,
      );
      context.drawImage(artwork, 0, 0, W, H);
      // Preserve the approved scene; overlay only live portfolio data.
      const shade = context.createLinearGradient(0, 0, 640, 0);
      shade.addColorStop(0, "rgba(3,9,27,.42)");
      shade.addColorStop(1, "rgba(3,9,27,0)");
      context.fillStyle = shade;
      context.fillRect(0, 0, W, H);
      const reference = await loadImage(
        "/position-share-neon-reference.webp",
        8000,
      );
      context.drawImage(
        reference,
        0,
        0,
        reference.naturalWidth,
        252,
        0,
        0,
        W,
        217,
      );
      const highResLogo = highResLogoUrl(position.asset.logoUrl),
        logoSource = highResLogo
          ? `/api/asset-logo?url=${encodeURIComponent(highResLogo)}`
          : null;
      context.beginPath();
      context.arc(104, 285, 43, 0, Math.PI * 2);
      context.fillStyle = "rgba(9,15,34,.76)";
      context.fill();
      context.strokeStyle = resultColor;
      context.lineWidth = 3;
      context.stroke();
      let logoDrawn = false;
      if (logoSource)
        try {
          const logo = await loadImage(logoSource, 4000),
            s = Math.min(78 / logo.naturalWidth, 78 / logo.naturalHeight);
          context.save();
          context.beginPath();
          context.arc(104, 285, 39, 0, Math.PI * 2);
          context.clip();
          context.drawImage(
            logo,
            104 - (logo.naturalWidth * s) / 2,
            285 - (logo.naturalHeight * s) / 2,
            logo.naturalWidth * s,
            logo.naturalHeight * s,
          );
          context.restore();
          logoDrawn = true;
        } catch {
          /* symbol fallback below */
        }
      if (!logoDrawn) {
        context.fillStyle = "#f7f8ff";
        context.textAlign = "center";
        context.font = "700 22px Inter, Arial";
        context.fillText(position.asset.symbol.slice(0, 4), 104, 293);
        context.textAlign = "left";
      }
      context.fillStyle = "#f8f9ff";
      context.font = "700 46px Inter, Arial";
      context.fillText(position.asset.symbol, 170, 281, 300);
      context.fillStyle = "#8da2d5";
      context.font = '600 19px "Noto Sans Georgian", Inter, Arial';
      context.fillText(
        positive ? "მოგებიანი პოზიცია" : "წაგებიანი პოზიცია",
        172,
        316,
      );
      context.fillStyle = resultColor;
      context.font = "800 94px Inter, Arial";
      context.fillText(percentage(position.returnPercent, true), 55, 414, 430);
      context.fillStyle = "#879bd0";
      context.font = "700 18px Inter, Arial";
      context.fillText("UNREALIZED P & L", 61, 449);
      context.fillStyle = "rgba(7,12,30,.76)";
      context.beginPath();
      context.roundRect(48, 500, 350, 116, 18);
      context.fill();
      context.strokeStyle = positive
        ? "rgba(70,238,178,.35)"
        : "rgba(255,102,139,.35)";
      context.stroke();
      context.fillStyle = "#8498c8";
      context.font = '500 16px "Noto Sans Georgian", Inter, Arial';
      context.fillText("პოზიციის ღირებულება", 72, 538);
      context.fillStyle = "#f8f9ff";
      context.font = "700 34px Inter, Arial";
      context.fillText(
        hideAmounts ? "••••••" : money(position.value),
        72,
        583,
        300,
      );
      context.fillStyle = "rgba(5,9,23,.86)";
      context.beginPath();
      context.roundRect(48, 858, 984, 174, 22);
      context.fill();
      context.strokeStyle = "rgba(121,145,214,.28)";
      context.stroke();
      const moodValues = [
        ["მიმდინარე ფასი", money(position.quote?.price ?? null)],
        ["საშ. შესყიდვა", money(position.averagePrice)],
      ];
      moodValues.forEach(([label, value], i) => {
        const x = 76 + i * 285;
        context.fillStyle = "#8094c5";
        context.font = '500 15px "Noto Sans Georgian", Inter, Arial';
        context.fillText(label, x, 906);
        context.fillStyle = "#f7f8ff";
        context.font = "700 25px Inter, Arial";
        context.fillText(hideAmounts ? "••••••" : value, x, 944, 255);
      });
      context.fillStyle = "#829fe8";
      context.font = "600 14px Inter, Arial";
      context.fillText("CCX PORTFOLIO TRACKER", 76, 995);
      try {
        const qrData = await QRCode.toDataURL(
            "https://ccxtracker.vercel.app/",
            {
              errorCorrectionLevel: "M",
              margin: 1,
              width: 160,
              color: { dark: "#080d20", light: "#ffffff" },
            },
          ),
          qr = await loadImage(qrData);
        context.fillStyle = "#fff";
        context.fillRect(902, 884, 104, 104);
        context.drawImage(qr, 908, 890, 92, 92);
      } catch {
        /* share remains available */
      }
      const image = await new Promise<Blob | null>((resolve) =>
        target.toBlob(resolve, "image/png"),
      );
      publish(image);
      return;
    }
    if (template === "reaction") {
      const reaction = await loadImage(
        positive
          ? "/position-share-reaction-profit.webp"
          : "/position-share-reaction-loss.webp",
        8000,
      );
      context.drawImage(reaction, 0, 0, W, H);
      const shade = context.createLinearGradient(0, 0, 0, H);
      shade.addColorStop(0, "rgba(2,5,13,.08)");
      shade.addColorStop(0.45, "rgba(2,5,13,.02)");
      shade.addColorStop(0.7, "rgba(2,5,13,.62)");
      shade.addColorStop(1, "rgba(2,5,13,.94)");
      context.fillStyle = shade;
      context.fillRect(0, 0, W, H);
      context.fillStyle = "rgba(5,9,20,.72)";
      context.beginPath();
      context.roundRect(42, 38, 996, 122, 22);
      context.fill();
      const mark = await loadImage("/ccx-mark-transparent-v2.webp", 8000);
      const markScale = Math.min(
        82 / mark.naturalWidth,
        82 / mark.naturalHeight,
      );
      context.drawImage(
        mark,
        68,
        57,
        mark.naturalWidth * markScale,
        mark.naturalHeight * markScale,
      );
      context.fillStyle = "#f7f8ff";
      context.font = "700 38px Inter, Arial";
      context.fillText("Crypto Collective", 170, 91);
      const titleGradient = context.createLinearGradient(470, 0, 530, 0);
      titleGradient.addColorStop(0, "#a14cff");
      titleGradient.addColorStop(1, "#ff4f91");
      context.fillStyle = titleGradient;
      context.font = "800 42px Inter, Arial";
      context.fillText("X", 483, 92);
      context.fillStyle = "#8baaff";
      context.font = "700 13px Inter, Arial";
      context.letterSpacing = "3px";
      context.fillText("TRACK · ANALYZE · GROW", 172, 125);
      context.letterSpacing = "0px";

      context.fillStyle = "rgba(4,8,20,.88)";
      context.beginPath();
      context.roundRect(42, 754, 996, 278, 24);
      context.fill();
      context.strokeStyle = positive
        ? "rgba(70,238,178,.48)"
        : "rgba(255,102,139,.48)";
      context.lineWidth = 2;
      context.stroke();
      const highResLogo = highResLogoUrl(position.asset.logoUrl);
      const logoSource = highResLogo
        ? `/api/asset-logo?url=${encodeURIComponent(highResLogo)}`
        : null;
      context.beginPath();
      context.arc(112, 833, 46, 0, Math.PI * 2);
      context.fillStyle = "rgba(14,20,39,.96)";
      context.fill();
      context.strokeStyle = resultColor;
      context.lineWidth = 3;
      context.stroke();
      context.fillStyle = "#f6f7ff";
      context.font = "700 25px Inter, Arial";
      context.textAlign = "center";
      context.fillText(position.asset.symbol.slice(0, 4), 112, 842);
      context.textAlign = "left";
      if (logoSource)
        try {
          const logo = await loadImage(logoSource, 4000);
          const scale = Math.min(
            84 / logo.naturalWidth,
            84 / logo.naturalHeight,
          );
          context.save();
          context.beginPath();
          context.arc(112, 833, 42, 0, Math.PI * 2);
          context.clip();
          context.drawImage(
            logo,
            112 - (logo.naturalWidth * scale) / 2,
            833 - (logo.naturalHeight * scale) / 2,
            logo.naturalWidth * scale,
            logo.naturalHeight * scale,
          );
          context.restore();
        } catch {
          /* symbol fallback remains visible */
        }
      context.fillStyle = "#f8f9ff";
      context.font = "700 42px Inter, Arial";
      context.fillText(position.asset.symbol, 176, 818);
      context.fillStyle = "#91a7de";
      context.font = '600 22px "Noto Sans Georgian", Inter, Arial';
      context.fillText(
        positive ? "მოგებიანი პოზიცია" : "წაგებიანი პოზიცია",
        176,
        855,
      );
      context.fillStyle = resultColor;
      context.font = "800 78px Inter, Arial";
      context.textAlign = "right";
      context.fillText(percentage(position.returnPercent, true), 1004, 842);
      context.textAlign = "left";
      line(context, 68, 892, 1012, 892, "rgba(135,157,220,.3)");
      const reactionValues = [
        ["მიმდინარე ფასი", money(position.quote?.price ?? null)],
        ["საშ. შესყიდვა", money(position.averagePrice)],
        ["პოზიციის ღირებულება", money(position.value)],
      ];
      reactionValues.forEach(([label, value], index) => {
        const x = 70 + index * 270;
        context.fillStyle = "#8496c5";
        context.font = '500 15px "Noto Sans Georgian", Inter, Arial';
        context.fillText(label, x, 932);
        context.fillStyle = "#f7f8ff";
        context.font = "700 24px Inter, Arial";
        context.fillText(hideAmounts ? "••••••" : value, x, 968);
      });
      try {
        const qrData = await QRCode.toDataURL(
          "https://ccxtracker.vercel.app/",
          {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 160,
            color: { dark: "#080d20", light: "#ffffff" },
          },
        );
        const qr = await loadImage(qrData);
        context.fillStyle = "#fff";
        context.fillRect(900, 910, 104, 104);
        context.drawImage(qr, 906, 916, 92, 92);
      } catch {
        /* card remains shareable */
      }
      const image = await new Promise<Blob | null>((resolve) =>
        target.toBlob(resolve, "image/png"),
      );
      publish(image);
      return;
    }
    const background = context.createLinearGradient(0, 0, W, H);
    background.addColorStop(0, "#070b1d");
    background.addColorStop(0.54, "#071a38");
    background.addColorStop(1, "#160829");
    context.fillStyle = background;
    context.fillRect(0, 0, W, H);
    for (let x = 0; x <= W; x += 54)
      line(context, x, 0, x, H, "rgba(67,132,255,.10)");
    for (let y = 0; y <= H; y += 54)
      line(context, 0, y, W, y, "rgba(67,132,255,.10)");
    const glow = context.createRadialGradient(815, 430, 20, 815, 430, 430);
    glow.addColorStop(0, "rgba(219,65,255,.30)");
    glow.addColorStop(1, "rgba(18,39,118,0)");
    context.fillStyle = glow;
    context.fillRect(430, 0, 650, 770);
    // The complete card is painted before optional remote assets arrive.  This is
    // important on phones, where awaiting an image used to leave the preview blank.
    // Reuse the approved artwork's brand header, never its sample financial data.
    const brandMarkPromise = loadImage(
      "/position-share-neon-reference.webp",
      8000,
    ).then((reference) => {
      context.drawImage(
        reference,
        0,
        0,
        reference.naturalWidth,
        252,
        0,
        0,
        W,
        217,
      );
    });
    // Keep the asset mark clean: a round crop, without a blue ring, disc, or glow.
    context.fillStyle = "#f6f7ff";
    context.font = "700 40px Inter, Arial";
    context.textAlign = "center";
    context.fillText(position.asset.symbol.slice(0, 4), 130, 339);
    context.textAlign = "left";
    const highResLogo = highResLogoUrl(position.asset.logoUrl);
    const logoSource = highResLogo
      ? `/api/asset-logo?url=${encodeURIComponent(highResLogo)}`
      : null;
    const assetLogoPromise = logoSource
      ? loadImage(logoSource, 4000)
          .then((logo) => {
            const scale = Math.min(
              108 / logo.naturalWidth,
              108 / logo.naturalHeight,
            );
            const width = logo.naturalWidth * scale,
              height = logo.naturalHeight * scale;
            context.save();
            context.beginPath();
            context.arc(130, 325, 54, 0, Math.PI * 2);
            context.clip();
            context.drawImage(
              logo,
              130 - width / 2,
              325 - height / 2,
              width,
              height,
            );
            context.restore();
          })
          .catch(() => undefined)
      : Promise.resolve();
    context.fillStyle = "#f6f7ff";
    context.font = "700 64px Inter, Arial";
    context.fillText(position.asset.symbol, 226, 342);
    context.fillStyle = "#f6f7ff";
    context.font = '700 46px "Noto Sans Georgian", Inter, Arial';
    context.fillText("ჩემი პოზიცია", 56, 465);
    context.fillStyle = resultColor;
    context.shadowColor = resultColor;
    context.shadowBlur = 6;
    context.font = "800 108px Inter, Arial";
    context.fillText(percentage(position.returnPercent, true), 52, 605);
    context.shadowBlur = 0;
    context.fillStyle = "#91a7de";
    context.font = "700 24px Inter, Arial";
    context.fillText("P & L", 60, 642);
    for (let x = 585; x <= 1015; x += 86)
      line(context, x, 255, x, 650, "rgba(55,120,255,.22)");
    for (let y = 280; y <= 650; y += 74)
      line(context, 575, y, 1018, y, "rgba(55,120,255,.22)");
    context.fillStyle = "#7895dc";
    context.font = "500 15px Inter, Arial";
    ["180", "160", "140", "120", "100", "80"].forEach((label, index) =>
      context.fillText(label, 1023, 286 + index * 72),
    );
    const points = positive
      ? [
          [575, 620],
          [620, 585],
          [663, 607],
          [704, 510],
          [747, 551],
          [794, 448],
          [838, 485],
          [884, 386],
          [929, 422],
          [978, 324],
        ]
      : [
          [575, 324],
          [620, 365],
          [663, 348],
          [704, 432],
          [747, 401],
          [794, 498],
          [838, 470],
          [884, 555],
          [929, 526],
          [978, 620],
        ];
    context.strokeStyle = resultColor;
    context.shadowColor = resultColor;
    context.shadowBlur = 13;
    context.lineWidth = 5;
    context.beginPath();
    points.forEach(([x, y], index) =>
      index ? context.lineTo(x, y) : context.moveTo(x, y),
    );
    context.stroke();
    context.shadowBlur = 0;
    const last = points[points.length - 1];
    context.beginPath();
    context.arc(last[0], last[1], 10, 0, Math.PI * 2);
    context.fillStyle = "#fff";
    context.fill();
    context.lineWidth = 5;
    context.strokeStyle = resultColor;
    context.stroke();
    context.beginPath();
    context.roundRect(884, 245, 118, 42, 10);
    context.fillStyle = "#172c76";
    context.fill();
    context.strokeStyle = "#7d55ff";
    context.stroke();
    context.fillStyle = resultColor;
    context.font = "700 22px Inter, Arial";
    context.fillText(percentage(position.returnPercent, true), 900, 273);
    panel(context, 44, 706, 300, 138, "#287de8");
    panel(context, 390, 706, 300, 138, "#914fff");
    panel(context, 736, 706, 300, 138, "#fe8a34");
    context.fillStyle = "#289cff";
    context.fillRect(72, 764, 8, 36);
    context.fillRect(87, 747, 8, 53);
    context.fillRect(102, 756, 8, 44);
    context.strokeStyle = "#a347ff";
    context.lineWidth = 5;
    [755, 773, 791].forEach((y) => {
      context.beginPath();
      context.ellipse(430, y, 23, 8, 0, 0, Math.PI * 2);
      context.stroke();
    });
    context.strokeStyle = "#ff9b23";
    context.lineWidth = 5;
    context.beginPath();
    context.arc(776, 772, 27, -Math.PI / 2, Math.PI * 1.45);
    context.stroke();
    line(context, 776, 772, 776, 744, "#ff9b23", 5);
    line(context, 776, 772, 803, 772, "#ff9b23", 5);
    const values = [
      ["მიმდინარე ფასი", money(position.quote?.price ?? null)],
      ["საშ. შესყიდვა", money(position.averagePrice)],
      ["პოზიციის ღირებულება", money(position.value)],
    ];
    values.forEach(([label, value], index) => {
      const x = 126 + index * 346;
      context.fillStyle = "#9eafdb";
      context.font = '500 17px "Noto Sans Georgian", Inter, Arial';
      context.fillText(label, x, 752);
      context.fillStyle = "#f8f9ff";
      context.font = "700 32px Inter, Arial";
      context.fillText(hideAmounts ? "••••••" : value, x, 804);
    });
    for (let x = 0; x <= W; x += 54)
      line(context, x, 858, x, 1080, "rgba(67,132,255,.08)");
    line(context, 45, 914, 1035, 914, "rgba(50,127,255,.7)", 2);
    context.fillStyle = "#287de8";
    context.fillRect(58, 969, 8, 35);
    context.fillRect(74, 950, 8, 54);
    context.fillRect(90, 960, 8, 44);
    context.fillStyle = "#f3f5ff";
    context.font = '700 29px "Noto Sans Georgian", Inter, Arial';
    context.fillText("პორტფელის ტრეკერი", 122, 977);
    context.fillStyle = "#608be9";
    context.font = "600 15px Inter, Arial";
    context.fillText("TRACK · ANALYZE · GROW TOGETHER", 122, 1010);
    line(context, 720, 944, 720, 1027, "rgba(125,148,218,.65)", 2);
    context.fillStyle = "#91a7de";
    context.font = '500 22px "Noto Sans Georgian", Inter, Arial';
    context.fillText("მეტი", 750, 965);
    context.fillText("ინსაითები", 750, 996);
    try {
      const qrData = await QRCode.toDataURL("https://ccxtracker.vercel.app/", {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 180,
        color: { dark: "#080d20", light: "#ffffff" },
      });
      const qr = await loadImage(qrData);
      context.fillStyle = "#fff";
      context.fillRect(925, 934, 100, 100);
      context.drawImage(qr, 931, 940, 88, 88);
    } catch {
      /* A QR failure must never prevent preview or mobile sharing. */
    }
    // A missing remote coin logo must never block the share card on a phone.
    await Promise.all([brandMarkPromise, assetLogoPromise]);
    const image = await new Promise<Blob | null>((resolve) =>
      target.toBlob(resolve, "image/png"),
    );
    publish(image);
  }, [hideAmounts, positive, position, template]);
  const chooseTemplate = (next: ShareTemplate) => {
    sharedImage.current = null;
    setReady(false);
    setStatus("ბარათი ახლდება…");
    setTemplate(next);
    window.localStorage.setItem(templateStorageKey, next);
  };
  const openShare = () => {
    const saved = window.localStorage.getItem(templateStorageKey);
    if (saved === "performance" || saved === "reaction" || saved === "mood")
      setTemplate(saved);
    sharedImage.current = null;
    setReady(false);
    setStatus("ბარათი მზადდება…");
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const generation = renderVersion;
    const frame = window.requestAnimationFrame(
      () =>
        void render().catch(() => {
          setReady(false);
          setStatus(
            "სურათის ჩატვირთვა ვერ მოხერხდა. დახურეთ და თავიდან გახსენით.",
          );
        }),
    );
    return () => {
      window.cancelAnimationFrame(frame);
      ++generation.current;
    };
  }, [open, render]);
  const download = () => {
    const image = sharedImage.current;
    if (!image) {
      setStatus("ბარათი ჯერ მზადდება.");
      return;
    }
    const url = URL.createObjectURL(image);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ccx-${position.asset.symbol.toLowerCase()}-position.png`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const share = () => {
    const image = sharedImage.current;
    if (!image) {
      setStatus("ბარათი ჯერ მზადდება.");
      return;
    }
    const title = `${position.asset.symbol} · Crypto Collective X`;
    const text = `${position.asset.symbol}-ის პოზიცია Crypto Collective X-ში`;
    const url = "https://ccxtracker.vercel.app/";
    const file = new File(
      [image],
      `ccx-${position.asset.symbol.toLowerCase()}-position.png`,
      { type: "image/png" },
    );
    if (typeof navigator.share !== "function") {
      download();
      setStatus("ამ ბრაუზერს სისტემური გაზიარება არ აქვს; PNG ჩამოიტვირთა.");
      return;
    }
    const shareImage =
      !navigator.canShare || navigator.canShare({ files: [file] });
    const request = shareImage
      ? navigator.share({ title, text, files: [file] })
      : navigator.share({ title, text, url });
    void request
      .then(() =>
        setStatus(
          shareImage
            ? "სურათი გაზიარებისთვის გაიხსნა."
            : "ამ ბრაუზერმა სურათის ფაილი ვერ მიიღო; გაიგზავნა ბმული.",
        ),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setStatus("გაზიარება ვერ გაიხსნა. სცადეთ PNG-ის შენახვა.");
      });
  };
  return (
    <>
      <button
        type="button"
        className={compact ? "ccx-icon-button" : "button-secondary"}
        aria-label={compact ? "პოზიციის გაზიარება" : undefined}
        title={compact ? "პოზიციის გაზიარება" : undefined}
        onClick={openShare}
      >
        <Share2 size={15} />
        {!compact && " გაზიარება"}
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="ccx-modal-overlay position-share-overlay" />
          <Dialog.Content
            className="position-share-sheet"
            aria-describedby="position-share-description position-share-data"
          >
            <Dialog.Title>პოზიციის გაზიარება</Dialog.Title>
            <Dialog.Description id="position-share-description">
              აირჩიეთ დიზაინი და გააზიარეთ მხოლოდ ის მონაცემები, რომელთა
              გამოჩენაც გსურთ.
            </Dialog.Description>
            <Dialog.Close className="position-share-close" aria-label="დახურვა">
              <X size={18} />
            </Dialog.Close>
            <div className="position-share-dialog">
              <div
                className="position-share-templates"
                role="group"
                aria-label="გაზიარების შაბლონი"
              >
                <button
                  type="button"
                  aria-pressed={template === "performance"}
                  onClick={() => chooseTemplate("performance")}
                >
                  კლასიკური
                </button>
                <button
                  type="button"
                  aria-pressed={template === "reaction"}
                  onClick={() => chooseTemplate("reaction")}
                >
                  რეაქცია
                </button>
                <button
                  type="button"
                  aria-pressed={template === "mood"}
                  onClick={() => chooseTemplate("mood")}
                >
                  პერსონაჟი
                </button>
              </div>
              <p id="position-share-data" className="sr-only">
                {position.asset.symbol} პოზიცია. შედეგი{" "}
                {percentage(position.returnPercent, true)}. მიმდინარე ფასი{" "}
                {money(position.quote?.price ?? null)}. საშუალო შესყიდვა{" "}
                {hideAmounts ? "დამალულია" : money(position.averagePrice)}.
                პოზიციის ღირებულება{" "}
                {hideAmounts ? "დამალულია" : money(position.value)}.
              </p>
              <canvas
                ref={canvas}
                className="position-share-preview"
                role="img"
                aria-label={`${position.asset.symbol} პოზიციის გაზიარების ბარათი`}
                aria-describedby="position-share-data"
              />
              <div className="position-share-controls">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    sharedImage.current = null;
                    setReady(false);
                    setStatus("ბარათი ახლდება…");
                    setHideAmounts((value) => !value);
                  }}
                >
                  {hideAmounts ? <Eye size={15} /> : <EyeOff size={15} />}
                  {hideAmounts ? "თანხების ჩვენება" : "თანხების დამალვა"}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={!ready}
                  onClick={download}
                >
                  <Download size={15} /> PNG
                </button>
                <button
                  type="button"
                  className="button-primary"
                  disabled={!ready}
                  onClick={share}
                >
                  <Share2 size={15} /> გაზიარება
                </button>
              </div>
              {status && (
                <p role="status" className="text-xs text-muted">
                  {status}
                </p>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
