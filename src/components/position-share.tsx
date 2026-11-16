"use client";

import { useCallback, useEffect, useRef, useState, useId } from "react";
import { Download, Eye, EyeOff, Share2 } from "lucide-react";
import { X } from "lucide-react";
import type { ValuedPosition } from "@/domain/types";
import { money, percentage, unitPrice } from "@/lib/formatters";
import { highResLogoUrl } from "@/lib/asset-logo";


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

export function PositionShare({
  position,
  compact = false,
}: {
  position: ValuedPosition;
  compact?: boolean;
}) {
  const previewId = useId();
  const [open, setOpen] = useState(false),
    [hideAmounts, setHideAmounts] = useState(false),
    [ready, setReady] = useState(false),
    [status, setStatus] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sharedImage = useRef<Blob | null>(null);
  const renderVersion = useRef(0);
  const positive =
    position.unrealizedPnl !== null && Number(position.unrealizedPnl) >= 0;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
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
    const width = 960;
    const height = 500;
    target.width = width;
    target.height = height;
    const accent = position.returnPercent === null
      ? "#b6c3df"
      : positive ? "#46eeb2" : "#ff789b";
    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, "#080d1d");
    background.addColorStop(1, "#17102e");
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    const drawText = (
      text: string, x: number, y: number, size: number,
      maxWidth: number, color = "#f7f8ff", weight = 600,
    ) => {
      context.fillStyle = color;
      context.font = `${weight} ${size}px "Noto Sans Georgian", Inter, Arial`;
      context.fillText(text, x, y, maxWidth);
    };

    drawText("Crypto Collective X", 44, 60, 26, 650);
    drawText(position.asset.symbol, 126, 147, 42, 310);
    drawText(position.asset.name, 126, 179, 20, 310, "#b6c3df", 500);
    drawText("არარეალიზებული შედეგი", 474, 133, 20, 442, "#b6c3df");
    drawText(percentage(position.returnPercent, true), 470, 218, 76, 446, accent, 750);

    const values = [
      ["საშუალო შესვლის ფასი", unitPrice(position.averagePrice)],
      ["მიმდინარე ფასი", unitPrice(position.quote?.price ?? null)],
      ["პოზიციის ღირებულება", money(position.value)],
    ];
    values.forEach(([label, value], index) => {
      const x = 44 + index * 298;
      context.beginPath();
      context.roundRect(x, 288, 276, 116, 14);
      context.fillStyle = "#20203a";
      context.fill();
      drawText(label, x + 16, 328, 18, 244, "#b6c3df");
      drawText(hideAmounts ? "••••••" : value, x + 16, 376, 31, 244);
    });
    drawText(window.location.host, 44, 460, 18, 872, "#b6c3df", 500);

    const source = highResLogoUrl(position.asset.logoUrl);
    const logo = source
      ? await loadImage(`/api/asset-logo?url=${encodeURIComponent(source)}`).catch(() => null)
      : null;
    if (logo) {
      context.save();
      context.beginPath();
      context.arc(76, 148, 32, 0, Math.PI * 2);
      context.clip();
      context.drawImage(logo, 44, 116, 64, 64);
      context.restore();
    } else {
      drawText(position.asset.symbol.slice(0, 4), 44, 158, 24, 64);
    }
    target.toBlob(publish, "image/png");
  }, [hideAmounts, positive, position]);
  const openShare = () => {
    sharedImage.current = null;
    setReady(false);
    setStatus("სურათი მზადდება.");
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
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
      ++renderVersion.current;
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
    const url = window.location.origin;
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
        className={compact ? "btn btn-ghost btn-square" : "btn btn-outline"}
        aria-label={compact ? "პოზიციის გაზიარება" : undefined}
        title={compact ? "პოზიციის გაზიარება" : undefined}
        onClick={openShare}
      >
        <Share2 size={15} />
        {!compact && " გაზიარება"}
      </button>
      <dialog
        ref={dialogRef}
        className="modal modal-bottom lg:modal-middle"
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}
        aria-labelledby={`${previewId}-title`}
        aria-describedby="position-share-description position-share-data"
      >
        <div className="modal-box max-h-[92dvh] w-full max-w-xl overflow-y-auto border border-base-300 bg-base-200 p-4 lg:p-5">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Share2
                size={18}
                className="shrink-0 text-base-content/60"
                aria-hidden="true"
              />
              <h2
                id={`${previewId}-title`}
                className="truncate text-base font-semibold"
              >
                გაზიარება{" "}
                <span className="ml-2 text-sm font-normal text-base-content/60">
                  {position.asset.symbol}
                </span>
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn btn-square btn-ghost min-h-11 min-w-11 shrink-0"
              aria-label="დახურვა"
            >
              <X size={18} />
            </button>
          </div>
          <p id="position-share-description" className="sr-only">
            აირჩიეთ დიზაინი და გააზიარეთ მხოლოდ ის მონაცემები, რომელთა გამოჩენაც
            გსურთ.
          </p>
          <div className="mt-1 grid min-w-0 gap-3">
            <p id="position-share-data" className="sr-only">
              {position.asset.symbol} პოზიცია. შედეგი{" "}
              {percentage(position.returnPercent, true)}. მიმდინარე ფასი{" "}
              {hideAmounts ? "დამალულია" : unitPrice(position.quote?.price ?? null)}. საშუალო შესყიდვა{" "}
              {hideAmounts ? "დამალულია" : unitPrice(position.averagePrice)}.
              პოზიციის ღირებულება{" "}
              {hideAmounts ? "დამალულია" : money(position.value)}.
            </p>
            <canvas
              ref={canvas}
              id={previewId}
              className="mx-auto block h-auto w-full rounded-box border border-base-300 bg-base-300"
              role="img"
              aria-label={`${position.asset.symbol} პოზიციის გაზიარების ბარათი`}
              aria-describedby="position-share-data"
            />
            <div className="modal-action sticky bottom-0 z-10 mt-0 flex-wrap bg-base-200 py-3">
              <button
                type="button"
                className="btn btn-outline"
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
                className="btn btn-outline"
                disabled={!ready}
                onClick={download}
              >
                <Download size={15} /> PNG
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!ready}
                onClick={share}
              >
                <Share2 size={15} /> გაზიარება
              </button>
            </div>
            {status && (
              <p role="status" className="text-sm text-base-content/60">
                {status}
              </p>
            )}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button aria-label="დახურვა">დახურვა</button>
        </form>
      </dialog>
    </>
  );
}
