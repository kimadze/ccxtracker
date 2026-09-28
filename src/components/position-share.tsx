"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eye, EyeOff, Share2 } from "lucide-react";
import type { ValuedPosition } from "@/domain/types";
import { money, percentage } from "@/lib/formatters";
import { Modal } from "./ui";

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

function line(context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 1) {
  context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.strokeStyle = color; context.lineWidth = width; context.stroke();
}
function panel(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) {
  context.beginPath(); context.roundRect(x, y, width, height, 18); context.fillStyle = "rgba(7,12,32,.74)"; context.fill(); context.strokeStyle = color; context.lineWidth = 2; context.stroke();
}

export function PositionShare({ position }: { position: ValuedPosition }) {
  const [open, setOpen] = useState(false), [hideAmounts, setHideAmounts] = useState(false), [ready, setReady] = useState(false), [status, setStatus] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const positive = position.unrealizedPnl !== null && Number(position.unrealizedPnl) >= 0;
  const pnl = `${positive && position.unrealizedPnl ? "+" : ""}${money(position.unrealizedPnl)}`;
  const render = useCallback(async () => {
    const target = canvas.current; if (!target) return;
    const context = target.getContext("2d"); if (!context) return;
    const W = 1080, H = 1080; target.width = W; target.height = H;
    const background = context.createLinearGradient(0, 0, W, H); background.addColorStop(0, "#070b1d"); background.addColorStop(.54, "#071a38"); background.addColorStop(1, "#160829"); context.fillStyle = background; context.fillRect(0, 0, W, H);
    for (let x = 0; x <= W; x += 54) line(context, x, 0, x, H, "rgba(67,132,255,.10)");
    for (let y = 0; y <= H; y += 54) line(context, 0, y, W, y, "rgba(67,132,255,.10)");
    const glow = context.createRadialGradient(815, 430, 20, 815, 430, 430); glow.addColorStop(0, "rgba(219,65,255,.30)"); glow.addColorStop(1, "rgba(18,39,118,0)"); context.fillStyle = glow; context.fillRect(430, 0, 650, 770);
    try { const logo = await loadImage("/ccx-mark-transparent.png"); context.drawImage(logo, 48, 36, 185, 185); } catch { /* Brand text remains available. */ }
    line(context, 250, 43, 250, 210, "rgba(128,152,229,.58)", 2);
    context.fillStyle = "#f6f7ff"; context.font = "700 58px Inter, Arial"; context.fillText("Crypto", 282, 93); context.fillText("Collective", 282, 150);
    const xGradient = context.createLinearGradient(575, 72, 670, 150); xGradient.addColorStop(0, "#726dff"); xGradient.addColorStop(.5, "#dc22ff"); xGradient.addColorStop(1, "#ff8a24"); context.fillStyle = xGradient; context.font = "800 84px Inter, Arial"; context.fillText("X", 575, 151);
    context.fillStyle = "#7592dc"; context.font = "600 18px Inter, Arial"; context.letterSpacing = "8px"; context.fillText("TOGETHER WE TRADE SMARTER", 285, 197); context.letterSpacing = "0px";
    context.fillStyle = "#6d85c8"; context.font = "600 17px Inter, Arial"; ["PEOPLE", "DATA", "DISCIPLINE", "HIGHER", "TOGETHER"].forEach((word, index) => context.fillText(word, 910, 62 + index * 27)); line(context, 910, 203, 1034, 203, "#8e4dff", 3);
    context.beginPath(); context.arc(130, 325, 76, 0, Math.PI * 2); context.fillStyle = "#0b112b"; context.fill(); context.lineWidth = 5; context.strokeStyle = "#2d9cff"; context.stroke();
    let assetLogo = false;
    if (position.asset.logoUrl) try { const logo = await loadImage(position.asset.logoUrl); context.save(); context.beginPath(); context.arc(130, 325, 56, 0, Math.PI * 2); context.clip(); context.drawImage(logo, 74, 269, 112, 112); context.restore(); assetLogo = true; } catch { /* Use ticker fallback. */ }
    if (!assetLogo) { context.fillStyle = "#c85cff"; context.font = "700 40px Inter, Arial"; context.textAlign = "center"; context.fillText(position.asset.symbol.slice(0, 4), 130, 339); context.textAlign = "left"; }
    context.fillStyle = "#f6f7ff"; context.font = "700 56px Inter, Arial"; context.fillText(`${position.asset.symbol} · ${position.asset.name}`, 226, 342);
    context.fillStyle = "#f6f7ff"; context.font = '700 46px "Noto Sans Georgian", Inter, Arial'; context.fillText("ჩემი პოზიცია", 56, 465);
    const resultColor = positive ? "#46eeb2" : "#ff668b"; context.fillStyle = resultColor; context.shadowColor = resultColor; context.shadowBlur = 18; context.font = "800 108px Inter, Arial"; context.fillText(percentage(position.returnPercent, true), 52, 605); context.shadowBlur = 0;
    context.fillStyle = "#91a7de"; context.font = "700 24px Inter, Arial"; context.fillText("P & L", 60, 642);
    for (let x = 585; x <= 1015; x += 86) line(context, x, 255, x, 650, "rgba(55,120,255,.22)"); for (let y = 280; y <= 650; y += 74) line(context, 575, y, 1018, y, "rgba(55,120,255,.22)");
    context.fillStyle = "#7895dc"; context.font = "500 15px Inter, Arial"; ["180", "160", "140", "120", "100", "80"].forEach((label, index) => context.fillText(label, 1023, 286 + index * 72));
    const points = positive ? [[575,620],[620,585],[663,607],[704,510],[747,551],[794,448],[838,485],[884,386],[929,422],[978,324]] : [[575,324],[620,365],[663,348],[704,432],[747,401],[794,498],[838,470],[884,555],[929,526],[978,620]];
    context.strokeStyle = resultColor; context.shadowColor = resultColor; context.shadowBlur = 13; context.lineWidth = 5; context.beginPath(); points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y)); context.stroke(); context.shadowBlur = 0; const last = points[points.length - 1]; context.beginPath(); context.arc(last[0], last[1], 10, 0, Math.PI * 2); context.fillStyle = "#fff"; context.fill(); context.lineWidth = 5; context.strokeStyle = resultColor; context.stroke();
    context.beginPath(); context.roundRect(884, 245, 118, 42, 10); context.fillStyle = "#172c76"; context.fill(); context.strokeStyle = "#7d55ff"; context.stroke(); context.fillStyle = resultColor; context.font = "700 22px Inter, Arial"; context.fillText(percentage(position.returnPercent, true), 900, 273);
    panel(context, 44, 706, 300, 138, "#287de8"); panel(context, 390, 706, 300, 138, "#914fff"); panel(context, 736, 706, 300, 138, "#fe8a34");
    const values = [
      ["მიმდინარე ფასი", money(position.quote?.price ?? null)],
      ["საშ. შესყიდვა", money(position.averagePrice)],
      ["პოზიციის ღირებულება", money(position.value)],
    ];
    values.forEach(([label, value], index) => { const x = 70 + index * 346; context.fillStyle = "#9eafdb"; context.font = '500 18px "Noto Sans Georgian", Inter, Arial'; context.fillText(label, x, 752); context.fillStyle = "#f8f9ff"; context.font = "700 35px Inter, Arial"; context.fillText(hideAmounts ? "••••••" : value, x, 804); });
    for (let x = 0; x <= W; x += 54) line(context, x, 858, x, 1080, "rgba(67,132,255,.08)"); line(context, 45, 914, 1035, 914, "rgba(50,127,255,.7)", 2);
    context.fillStyle = "#287de8"; context.fillRect(58, 969, 8, 35); context.fillRect(74, 950, 8, 54); context.fillRect(90, 960, 8, 44);
    context.fillStyle = "#f3f5ff"; context.font = '700 29px "Noto Sans Georgian", Inter, Arial'; context.fillText("პორტფელის მიმდევარი", 122, 977); context.fillStyle = "#608be9"; context.font = "600 15px Inter, Arial"; context.fillText("TRACK · ANALYZE · GROW TOGETHER", 122, 1010);
    line(context, 720, 944, 720, 1027, "rgba(125,148,218,.65)", 2); context.fillStyle = "#7792d3"; context.font = "500 17px Inter, Arial"; context.fillText(hideAmounts ? "PRIVATE" : pnl, 756, 978); context.strokeStyle = "#f5f7ff"; context.lineWidth = 4; context.strokeRect(935, 944, 78, 78); for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) if ((i * 3 + j * 5) % 4 < 2) { context.fillStyle = "#f5f7ff"; context.fillRect(946 + i * 10, 955 + j * 10, 6, 6); }
    setReady(true);
  }, [hideAmounts, pnl, positive, position]);
  useEffect(() => { if (open) void render(); }, [open, render]);
  const blob = () => new Promise<Blob | null>((resolve) => canvas.current?.toBlob(resolve, "image/png"));
  const download = async () => { const file = await blob(); if (!file) return; const url = URL.createObjectURL(file); const link = document.createElement("a"); link.href = url; link.download = `ccx-${position.asset.symbol.toLowerCase()}-position.png`; link.click(); URL.revokeObjectURL(url); };
  const share = async () => { const image = await blob(); if (!image) return; const file = new File([image], `ccx-${position.asset.symbol.toLowerCase()}-position.png`, { type: "image/png" }); if (navigator.canShare?.({ files: [file] })) { await navigator.share({ title: `${position.asset.symbol} · Crypto Collective X`, files: [file] }); return; } await download(); setStatus("თქვენი ბრაუზერი პირდაპირ გაზიარებას არ უჭერს მხარს; PNG ჩამოიტვირთა."); };
  return <>
    <button type="button" className="button-secondary" onClick={() => { setReady(false); setOpen(true); }}><Share2 size={15} /> გაზიარება</button>
    <Modal open={open} onOpenChange={setOpen} wide title="პოზიციის გაზიარება" description="შექმენით CCX-ის ბარათი და გააზიარეთ მხოლოდ ის მონაცემები, რომელთა გამოჩენაც გსურთ.">
      <div className="position-share-dialog"><canvas ref={canvas} className="position-share-preview" aria-label={`${position.asset.symbol} პოზიციის share ბარათი`} /><div className="position-share-controls"><button type="button" className="button-secondary" onClick={() => { setReady(false); setHideAmounts((value) => !value); }}>{hideAmounts ? <Eye size={15} /> : <EyeOff size={15} />}{hideAmounts ? "თანხების ჩვენება" : "თანხების დამალვა"}</button><button type="button" className="button-secondary" disabled={!ready} onClick={() => void download()}><Download size={15} /> PNG</button><button type="button" className="button-primary" disabled={!ready} onClick={() => void share()}><Share2 size={15} /> გაზიარება</button></div>{status && <p className="text-xs text-muted">{status}</p>}</div>
    </Modal>
  </>;
}
