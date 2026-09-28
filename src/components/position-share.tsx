"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eye, EyeOff, Share2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import QRCode from "qrcode";
import type { ValuedPosition } from "@/domain/types";
import { money, percentage } from "@/lib/formatters";

const loadImage = (src: string, timeoutMs = 1800) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  const timeout = window.setTimeout(() => reject(new Error("IMAGE_TIMEOUT")), timeoutMs);
  image.crossOrigin = "anonymous";
  image.onload = () => { window.clearTimeout(timeout); resolve(image); };
  image.onerror = (error) => { window.clearTimeout(timeout); reject(error); };
  image.src = src;
});

function line(context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 1) {
  context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.strokeStyle = color; context.lineWidth = width; context.stroke();
}
function panel(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) {
  context.beginPath(); context.roundRect(x, y, width, height, 18); context.fillStyle = "rgba(7,12,32,.74)"; context.fill(); context.strokeStyle = color; context.lineWidth = 2; context.stroke();
}

export function PositionShare({ position, compact = false }: { position: ValuedPosition; compact?: boolean }) {
  const [open, setOpen] = useState(false), [hideAmounts, setHideAmounts] = useState(false), [ready, setReady] = useState(false), [status, setStatus] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const sharedImage = useRef<Blob | null>(null);
  const positive = position.unrealizedPnl !== null && Number(position.unrealizedPnl) >= 0;
  const render = useCallback(async () => {
    const target = canvas.current; if (!target) return;
    const context = target.getContext("2d"); if (!context) return;
    const W = 1080, H = 1080; target.width = W; target.height = H;
    const background = context.createLinearGradient(0, 0, W, H); background.addColorStop(0, "#070b1d"); background.addColorStop(.54, "#071a38"); background.addColorStop(1, "#160829"); context.fillStyle = background; context.fillRect(0, 0, W, H);
    for (let x = 0; x <= W; x += 54) line(context, x, 0, x, H, "rgba(67,132,255,.10)");
    for (let y = 0; y <= H; y += 54) line(context, 0, y, W, y, "rgba(67,132,255,.10)");
    const glow = context.createRadialGradient(815, 430, 20, 815, 430, 430); glow.addColorStop(0, "rgba(219,65,255,.30)"); glow.addColorStop(1, "rgba(18,39,118,0)"); context.fillStyle = glow; context.fillRect(430, 0, 650, 770);
    // The complete card is painted before optional remote assets arrive.  This is
    // important on phones, where awaiting an image used to leave the preview blank.
    context.fillStyle = "rgba(3,8,26,.88)"; context.fillRect(0, 0, W, 218);
    context.fillStyle = "#f5f7ff"; context.font = "800 48px Inter, Arial"; context.fillText("Crypto", 188, 86); context.fillText("Collective", 188, 135);
    context.fillStyle = "#d63dff"; context.fillText("X", 440, 135);
    context.fillStyle = "#7fa9ff"; context.font = "700 15px Inter, Arial"; context.fillText("T O G E T H E R   W E   T R A D E   S M A R T E R", 190, 172);
    context.fillStyle = "#87a6ff"; context.font = "600 15px Inter, Arial"; context.textAlign = "right"; ["PEOPLE", "DATA", "DISCIPLINE", "HIGHER", "TOGETHER"].forEach((word, index) => context.fillText(word, 1020, 55 + index * 26)); context.textAlign = "left";
    const brandMarkPromise = loadImage("/ccx-mark-transparent.png", 4000).then((mark) => context.drawImage(mark, 52, 39, 105, 105)).catch(() => {
      context.beginPath(); context.arc(106, 92, 45, 0, Math.PI * 2); context.fillStyle = "#151039"; context.fill(); context.strokeStyle = "#d63dff"; context.lineWidth = 3; context.stroke(); context.fillStyle = "#ff9d26"; context.font = "800 24px Inter, Arial"; context.textAlign = "center"; context.fillText("CCX", 106, 101); context.textAlign = "left";
    });
    context.beginPath(); context.arc(130, 325, 76, 0, Math.PI * 2); context.fillStyle = "#0b112b"; context.fill(); context.lineWidth = 5; context.strokeStyle = "#2d9cff"; context.stroke();
    context.fillStyle = "#c85cff"; context.font = "700 40px Inter, Arial"; context.textAlign = "center"; context.fillText(position.asset.symbol.slice(0, 4), 130, 339); context.textAlign = "left";
    const logoSource = position.asset.logoUrl ? `/api/asset-logo?url=${encodeURIComponent(position.asset.logoUrl)}` : null;
    const assetLogoPromise = logoSource ? loadImage(logoSource, 4000).then((logo) => {
      context.save(); context.beginPath(); context.arc(130, 325, 56, 0, Math.PI * 2); context.clip(); context.fillStyle = "#0b112b"; context.fillRect(74, 269, 112, 112); context.drawImage(logo, 74, 269, 112, 112); context.restore();
    }).catch(() => undefined) : Promise.resolve();
    context.fillStyle = "#f6f7ff"; context.font = "700 64px Inter, Arial"; context.fillText(position.asset.symbol, 226, 342);
    context.fillStyle = "#f6f7ff"; context.font = '700 46px "Noto Sans Georgian", Inter, Arial'; context.fillText("ჩემი პოზიცია", 56, 465);
    const resultColor = positive ? "#46eeb2" : "#ff668b"; context.fillStyle = resultColor; context.shadowColor = resultColor; context.shadowBlur = 18; context.font = "800 108px Inter, Arial"; context.fillText(percentage(position.returnPercent, true), 52, 605); context.shadowBlur = 0;
    context.fillStyle = "#91a7de"; context.font = "700 24px Inter, Arial"; context.fillText("P & L", 60, 642);
    for (let x = 585; x <= 1015; x += 86) line(context, x, 255, x, 650, "rgba(55,120,255,.22)"); for (let y = 280; y <= 650; y += 74) line(context, 575, y, 1018, y, "rgba(55,120,255,.22)");
    context.fillStyle = "#7895dc"; context.font = "500 15px Inter, Arial"; ["180", "160", "140", "120", "100", "80"].forEach((label, index) => context.fillText(label, 1023, 286 + index * 72));
    const points = positive ? [[575,620],[620,585],[663,607],[704,510],[747,551],[794,448],[838,485],[884,386],[929,422],[978,324]] : [[575,324],[620,365],[663,348],[704,432],[747,401],[794,498],[838,470],[884,555],[929,526],[978,620]];
    context.strokeStyle = resultColor; context.shadowColor = resultColor; context.shadowBlur = 13; context.lineWidth = 5; context.beginPath(); points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y)); context.stroke(); context.shadowBlur = 0; const last = points[points.length - 1]; context.beginPath(); context.arc(last[0], last[1], 10, 0, Math.PI * 2); context.fillStyle = "#fff"; context.fill(); context.lineWidth = 5; context.strokeStyle = resultColor; context.stroke();
    context.beginPath(); context.roundRect(884, 245, 118, 42, 10); context.fillStyle = "#172c76"; context.fill(); context.strokeStyle = "#7d55ff"; context.stroke(); context.fillStyle = resultColor; context.font = "700 22px Inter, Arial"; context.fillText(percentage(position.returnPercent, true), 900, 273);
    panel(context, 44, 706, 300, 138, "#287de8"); panel(context, 390, 706, 300, 138, "#914fff"); panel(context, 736, 706, 300, 138, "#fe8a34");
    context.fillStyle = "#289cff"; context.fillRect(72, 764, 8, 36); context.fillRect(87, 747, 8, 53); context.fillRect(102, 756, 8, 44);
    context.strokeStyle = "#a347ff"; context.lineWidth = 5; [755, 773, 791].forEach((y) => { context.beginPath(); context.ellipse(430, y, 23, 8, 0, 0, Math.PI * 2); context.stroke(); });
    context.strokeStyle = "#ff9b23"; context.lineWidth = 5; context.beginPath(); context.arc(776, 772, 27, -Math.PI / 2, Math.PI * 1.45); context.stroke(); line(context, 776, 772, 776, 744, "#ff9b23", 5); line(context, 776, 772, 803, 772, "#ff9b23", 5);
    const values = [
      ["მიმდინარე ფასი", money(position.quote?.price ?? null)],
      ["საშ. შესყიდვა", money(position.averagePrice)],
      ["პოზიციის ღირებულება", money(position.value)],
    ];
    values.forEach(([label, value], index) => { const x = 126 + index * 346; context.fillStyle = "#9eafdb"; context.font = '500 17px "Noto Sans Georgian", Inter, Arial'; context.fillText(label, x, 752); context.fillStyle = "#f8f9ff"; context.font = "700 32px Inter, Arial"; context.fillText(hideAmounts ? "••••••" : value, x, 804); });
    for (let x = 0; x <= W; x += 54) line(context, x, 858, x, 1080, "rgba(67,132,255,.08)"); line(context, 45, 914, 1035, 914, "rgba(50,127,255,.7)", 2);
    context.fillStyle = "#287de8"; context.fillRect(58, 969, 8, 35); context.fillRect(74, 950, 8, 54); context.fillRect(90, 960, 8, 44);
    context.fillStyle = "#f3f5ff"; context.font = '700 29px "Noto Sans Georgian", Inter, Arial'; context.fillText("პორტფელის ტრეკერი", 122, 977); context.fillStyle = "#608be9"; context.font = "600 15px Inter, Arial"; context.fillText("TRACK · ANALYZE · GROW TOGETHER", 122, 1010);
    line(context, 720, 944, 720, 1027, "rgba(125,148,218,.65)", 2); context.fillStyle = "#7792d3"; context.font = '500 16px "Noto Sans Georgian", Inter, Arial'; context.fillText("მეტი ინსაითები", 750, 970); context.fillText("იხილეთ პლატფორმაზე", 750, 996);
    try {
      const qrData = await QRCode.toDataURL("https://ccxtracker.vercel.app/", { errorCorrectionLevel: "M", margin: 1, width: 180, color: { dark: "#080d20", light: "#ffffff" } });
      const qr = await loadImage(qrData); context.fillStyle = "#fff"; context.fillRect(925, 934, 100, 100); context.drawImage(qr, 931, 940, 88, 88);
    } catch { /* A QR failure must never prevent preview or mobile sharing. */ }
    // A missing remote coin logo must never block the share card on a phone.
    await Promise.race([Promise.all([brandMarkPromise, assetLogoPromise]), new Promise<void>((resolve) => window.setTimeout(resolve, 1800))]);
    const image = await new Promise<Blob | null>((resolve) => target.toBlob(resolve, "image/png"));
    sharedImage.current = image;
    setReady(true);
  }, [hideAmounts, positive, position]);
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => void render());
    return () => window.cancelAnimationFrame(frame);
  }, [open, render]);
  const download = () => { const image = sharedImage.current; if (!image) { setStatus("ბარათი ჯერ მზადდება."); return; } const url = URL.createObjectURL(image); const link = document.createElement("a"); link.href = url; link.download = `ccx-${position.asset.symbol.toLowerCase()}-position.png`; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const share = () => {
    const image = sharedImage.current;
    if (!image) { setStatus("ბარათი ჯერ მზადდება."); return; }
    const title = `${position.asset.symbol} · Crypto Collective X`;
    const text = `${position.asset.symbol}-ის პოზიცია Crypto Collective X-ში`;
    const url = "https://ccxtracker.vercel.app/";
    const file = new File([image], `ccx-${position.asset.symbol.toLowerCase()}-position.png`, { type: "image/png" });
    if (typeof navigator.share !== "function") { download(); setStatus("ამ ბრაუზერს სისტემური გაზიარება არ აქვს; PNG ჩამოიტვირთა."); return; }
    const shareImage = !navigator.canShare || navigator.canShare({ files: [file] });
    const request = shareImage ? navigator.share({ title, text, files: [file] }) : navigator.share({ title, text, url });
    void request.then(() => setStatus(shareImage ? "სურათი გაზიარებისთვის გაიხსნა." : "ამ ბრაუზერმა სურათის ფაილი ვერ მიიღო; გაიგზავნა ბმული.")).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("გაზიარება ვერ გაიხსნა. სცადეთ PNG-ის შენახვა.");
    });
  };
  return <>
    <button type="button" className={compact ? "ccx-icon-button" : "button-secondary"} aria-label={compact ? "პოზიციის გაზიარება" : undefined} title={compact ? "პოზიციის გაზიარება" : undefined} onClick={() => { sharedImage.current = null; setReady(false); setStatus("ბარათი მზადდება…"); setOpen(true); }}><Share2 size={15} />{!compact && " გაზიარება"}</button>
    <Dialog.Root open={open} onOpenChange={setOpen}><Dialog.Portal><Dialog.Overlay className="ccx-modal-overlay position-share-overlay" /><Dialog.Content className="position-share-sheet" aria-describedby="position-share-description"><Dialog.Title>პოზიციის გაზიარება</Dialog.Title><Dialog.Description id="position-share-description">შექმენით CCX-ის ბარათი და გააზიარეთ მხოლოდ ის მონაცემები, რომელთა გამოჩენაც გსურთ.</Dialog.Description><Dialog.Close className="position-share-close" aria-label="დახურვა"><X size={18} /></Dialog.Close><div className="position-share-dialog"><canvas ref={canvas} className="position-share-preview" aria-label={`${position.asset.symbol} პოზიციის share ბარათი`} /><div className="position-share-controls"><button type="button" className="button-secondary" onClick={() => { sharedImage.current = null; setReady(false); setStatus("ბარათი ახლდება…"); setHideAmounts((value) => !value); }}>{hideAmounts ? <Eye size={15} /> : <EyeOff size={15} />}{hideAmounts ? "თანხების ჩვენება" : "თანხების დამალვა"}</button><button type="button" className="button-secondary" disabled={!ready} onClick={download}><Download size={15} /> PNG</button><button type="button" className="button-primary" disabled={!ready} onClick={share}><Share2 size={15} /> გაზიარება</button></div>{status && <p role="status" className="text-xs text-muted">{status}</p>}</div></Dialog.Content></Dialog.Portal></Dialog.Root>
  </>;
}
