"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Eye, EyeOff, Share2 } from "lucide-react";
import type { ValuedPosition } from "@/domain/types";
import { money, percentage } from "@/lib/formatters";
import { Modal } from "./ui";

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

function line(context: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width = 1) {
  context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.strokeStyle = color; context.lineWidth = width; context.stroke();
}

export function PositionShare({ position }: { position: ValuedPosition }) {
  const [open, setOpen] = useState(false), [hideAmounts, setHideAmounts] = useState(false), [ready, setReady] = useState(false), [status, setStatus] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const positive = position.unrealizedPnl !== null && Number(position.unrealizedPnl) >= 0;
  const pnl = `${positive && position.unrealizedPnl ? "+" : ""}${money(position.unrealizedPnl)}`;
  const render = async () => {
    const target = canvas.current; if (!target) return;
    const context = target.getContext("2d"); if (!context) return;
    const W = 1080, H = 1080; target.width = W; target.height = H;
    const background = context.createLinearGradient(0, 0, W, H); background.addColorStop(0, "#070b1d"); background.addColorStop(.54, "#071a38"); background.addColorStop(1, "#160829"); context.fillStyle = background; context.fillRect(0, 0, W, H);
    for (let x = 0; x <= W; x += 54) line(context, x, 0, x, H, "rgba(67,132,255,.10)");
    for (let y = 0; y <= H; y += 54) line(context, 0, y, W, y, "rgba(67,132,255,.10)");
    context.fillStyle = "rgba(5,8,24,.72)"; context.fillRect(0, 0, W, 210);
    try { const logo = await loadImage("/ccx-collective-logo.png"); context.drawImage(logo, 58, 49, 92, 92); } catch { /* Brand text remains available. */ }
    context.fillStyle = "#f6f7ff"; context.font = "700 39px Inter, Arial"; context.fillText("Crypto Collective X", 171, 89);
    context.fillStyle = "#8ea5db"; context.font = "500 19px Inter, Arial"; context.fillText("POSITION SIGNAL", 173, 123);
    context.fillStyle = "#7198ff"; context.font = "600 16px Inter, Arial"; context.fillText("TRACK · ANALYZE · GROW", 812, 90);
    const arc = context.createRadialGradient(790, 435, 30, 790, 435, 355); arc.addColorStop(0, "rgba(219,65,255,.35)"); arc.addColorStop(1, "rgba(18,39,118,0)"); context.fillStyle = arc; context.fillRect(480, 170, 600, 580);
    context.beginPath(); context.arc(155, 340, 78, 0, Math.PI * 2); context.fillStyle = "#101532"; context.fill(); context.lineWidth = 5; context.strokeStyle = "#2d9cff"; context.stroke();
    context.fillStyle = "#c85cff"; context.font = "700 44px Inter, Arial"; context.textAlign = "center"; context.fillText(position.asset.symbol.slice(0, 4), 155, 355); context.textAlign = "left";
    context.fillStyle = "#f6f7ff"; context.font = "700 58px Inter, Arial"; context.fillText(`${position.asset.symbol} · ${position.asset.name}`, 270, 324);
    context.fillStyle = "#a9b7dd"; context.font = "500 25px Inter, Arial"; context.fillText("ჩემი პოზიცია", 271, 366);
    context.fillStyle = positive ? "#46eeb2" : "#ff668b"; context.font = "700 108px Inter, Arial"; context.fillText(percentage(position.returnPercent, true), 56, 578);
    context.fillStyle = "#b6c2e2"; context.font = "600 24px Inter, Arial"; context.fillText("არარეალიზებული P/L", 60, 622);
    context.strokeStyle = positive ? "#46eeb2" : "#ff668b"; context.lineWidth = 5; context.beginPath(); context.moveTo(585, 614); context.lineTo(658, 565); context.lineTo(705, 589); context.lineTo(748, 490); context.lineTo(802, 533); context.lineTo(862, 413); context.lineTo(940, 457); context.lineTo(1014, 300); context.stroke();
    context.fillStyle = "rgba(7,12,32,.86)"; context.fillRect(44, 708, 992, 182); [0, 1, 2].forEach((index) => { if (index) line(context, 374 + (index - 1) * 330, 734, 374 + (index - 1) * 330, 862, "rgba(147,164,222,.28)"); });
    const values = [
      ["მიმდინარე ფასი", money(position.quote?.price ?? null)],
      ["საშ. შესყიდვა", money(position.averagePrice)],
      ["პოზიციის ღირებულება", money(position.value)],
    ];
    values.forEach(([label, value], index) => { const x = 75 + index * 330; context.fillStyle = "#9eafdb"; context.font = "500 19px Inter, Arial"; context.fillText(label, x, 760); context.fillStyle = "#f8f9ff"; context.font = "700 38px Inter, Arial"; context.fillText(hideAmounts ? "••••••" : value, x, 816); });
    line(context, 50, 954, 1030, 954, "rgba(144,113,255,.55)", 2); context.fillStyle = "#d9e1ff"; context.font = "600 26px Inter, Arial"; context.fillText("Crypto Collective X", 58, 1010); context.fillStyle = "#7e96cd"; context.font = "500 18px Inter, Arial"; context.fillText(hideAmounts ? "პირადი მონაცემები დამალულია" : pnl, 755, 1010);
    setReady(true);
  };
  useEffect(() => { if (open) { setReady(false); void render(); } }, [open, hideAmounts]);
  const blob = () => new Promise<Blob | null>((resolve) => canvas.current?.toBlob(resolve, "image/png"));
  const download = async () => { const file = await blob(); if (!file) return; const url = URL.createObjectURL(file); const link = document.createElement("a"); link.href = url; link.download = `ccx-${position.asset.symbol.toLowerCase()}-position.png`; link.click(); URL.revokeObjectURL(url); };
  const share = async () => { const image = await blob(); if (!image) return; const file = new File([image], `ccx-${position.asset.symbol.toLowerCase()}-position.png`, { type: "image/png" }); if (navigator.canShare?.({ files: [file] })) { await navigator.share({ title: `${position.asset.symbol} · Crypto Collective X`, files: [file] }); return; } await download(); setStatus("თქვენი ბრაუზერი პირდაპირ გაზიარებას არ უჭერს მხარს; PNG ჩამოიტვირთა."); };
  return <>
    <button type="button" className="button-secondary" onClick={() => setOpen(true)}><Share2 size={15} /> გაზიარება</button>
    <Modal open={open} onOpenChange={setOpen} wide title="პოზიციის გაზიარება" description="შექმენით CCX-ის ბარათი და გააზიარეთ მხოლოდ ის მონაცემები, რომელთა გამოჩენაც გსურთ.">
      <div className="position-share-dialog"><canvas ref={canvas} className="position-share-preview" aria-label={`${position.asset.symbol} პოზიციის share ბარათი`} /><div className="position-share-controls"><button type="button" className="button-secondary" onClick={() => setHideAmounts((value) => !value)}>{hideAmounts ? <Eye size={15} /> : <EyeOff size={15} />}{hideAmounts ? "თანხების ჩვენება" : "თანხების დამალვა"}</button><button type="button" className="button-secondary" disabled={!ready} onClick={() => void download()}><Download size={15} /> PNG</button><button type="button" className="button-primary" disabled={!ready} onClick={() => void share()}><Share2 size={15} /> გაზიარება</button></div>{status && <p className="text-xs text-muted">{status}</p>}</div>
    </Modal>
  </>;
}
