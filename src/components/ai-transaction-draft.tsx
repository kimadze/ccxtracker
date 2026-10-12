"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  aiAvailability,
  parseTransactionText,
  screenshotAvailability,
} from "@/server/ai/actions";
import { AiScreenshotDraft } from "./ai-screenshot-draft";
import { BalanceValue, Field, Message } from "./ui";
import { kindLabels } from "@/domain/transaction-labels";
import { quantity, unitPrice } from "@/lib/formatters";

type Result = Extract<
  Awaited<ReturnType<typeof parseTransactionText>>,
  { ok: true }
>;
export type AiAppliedDraft = Result["draft"] & {
  asset: Result["matches"][number];
};
export function AiTransactionDraft({
  portfolioId,
  onApply,
  onBusy,
}: {
  portfolioId: string;
  onApply: (draft: AiAppliedDraft) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [imageAvailable, setImageAvailable] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [assetId, setAssetId] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const request = useRef(0);
  const disclosure = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    let mounted = true;
    const pendingRequest = request;
    void aiAvailability()
      .then((value) => {
        if (mounted) setAvailable(value);
      })
      .catch(() => {
        if (mounted) setAvailable(false);
      });
    void screenshotAvailability()
      .then((value) => {
        if (mounted) setImageAvailable(value);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      pendingRequest.current++;
    };
  }, []);
  return (
    <details
      ref={disclosure}
      className="collapse collapse-arrow border border-base-300 bg-base-100"
    >
      <summary className="collapse-title flex min-h-11 items-center gap-2 py-3 text-sm">
        <Sparkles size={16} /> ტექსტით შევსება
      </summary>
      <div className="collapse-content space-y-2">
        <p className="text-xs text-base-content/60">
          ტექსტი გაიგზავნება OpenAI-ში. პირადი მონაცემები არ ჩაწერო. შენახვამდე
          გადაამოწმე მონახაზი.
        </p>
        <Field label="ტრანზაქციის აღწერა">
          <textarea
            className="textarea w-full"
            rows={2}
            maxLength={600}
            disabled={pending || imageBusy}
            value={text}
            onChange={(e) => {
              request.current++;
              setText(e.target.value);
              setResult(null);
              setError("");
            }}
            placeholder="გავყიდე 500 XLM თითო $0.12-ად"
          />
        </Field>
        {available === false && (
          <p className="text-xs text-base-content/60">
            AI ჯერ არ არის ჩართული. ფორმა ხელით შეგიძლია შეავსო.
          </p>
        )}
        <button
          type="button"
          className="btn min-h-11"
          disabled={
            !available || pending || imageBusy || text.trim().length < 5
          }
          onClick={async () => {
            const version = ++request.current;
            setPending(true);
            onBusy(true);
            setError("");
            setResult(null);
            try {
              const reply = await parseTransactionText({
                portfolioId,
                text,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              });
              if (version !== request.current) return;
              if (reply.ok) {
                setResult(reply);
                setAssetId(
                  reply.matches.length === 1 ? reply.matches[0].id : "",
                );
              } else setError(reply.error);
            } catch {
              if (version === request.current)
                setError("ტექსტი ვერ გაიშიფრა. სცადე ხელახლა.");
            } finally {
              setPending(false);
              onBusy(false);
            }
          }}
        >
          {pending ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <Sparkles size={15} />
          )}{" "}
          მონახაზის მომზადება
        </button>
        {error && <Message error>{error}</Message>}
        {imageAvailable && (
          <AiScreenshotDraft
            portfolioId={portfolioId}
            disabled={pending}
            onReset={() => {
              request.current++;
              setResult(null);
              setError("");
            }}
            onBusy={(busy) => {
              setImageBusy(busy);
              onBusy(busy);
            }}
            onResult={(reply) => {
              setResult(reply);
              setAssetId(reply.matches.length === 1 ? reply.matches[0].id : "");
            }}
          />
        )}
        {result && (
          <div className="space-y-2 border-t border-base-300 pt-2">
            <p className="text-sm">
              {kindLabels[result.draft.kind]} ·{" "}
              <BalanceValue>{quantity(result.draft.quantity)}</BalanceValue>{" "}
              {result.draft.symbol} ·{" "}
              <BalanceValue>{unitPrice(result.draft.price)}</BalanceValue>
            </p>
            {result.matches.length > 1 && (
              <Field label="დააზუსტე აქტივი">
                <select
                  className="select w-full"
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                >
                  <option value="">აირჩიე აქტივი</option>
                  {result.matches.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.symbol} · {asset.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <p className="text-xs text-base-content/60">
              შეამოწმე ფასი, საკომისიო და თარიღი. ეს მოქმედება ტრანზაქციას არ
              ინახავს.
            </p>
            <button
              type="button"
              className="btn btn-primary min-h-11"
              disabled={!assetId}
              onClick={() => {
                const asset = result.matches.find((a) => a.id === assetId);
                if (asset) {
                  onApply({ ...result.draft, asset });
                  setResult(null);
                  if (disclosure.current) disclosure.current.open = false;
                }
              }}
            >
              ფორმაში გადატანა
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
