"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw, Settings2, ArrowLeft, ExternalLink } from "lucide-react";
import type { WalletNetwork, WalletSnapshot } from "@/domain/wallet";
import { walletSnapshotStale } from "@/domain/wallet";
import { decimal } from "@/domain/decimal";
import { money, quantity, dateTime } from "@/lib/formatters";
import { BalancePrivacyToggle } from "./shell";
import { BalanceValue, Field, Message, Modal } from "./ui";
import {
  refreshWalletPortfolio,
  updateWalletPortfolio,
  removeWalletPortfolio,
} from "@/server/wallet-actions";

type WalletProps = {
  id: string;
  name: string;
  network: WalletNetwork;
  addresses: string[];
  snapshot: WalletSnapshot | null;
  lastError: string | null;
};
export function WalletWorkspace({ wallet }: { wallet: WalletProps }) {
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(false),
    [deleting, setDeleting] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const started = useRef(false);
  async function refresh() {
    setPending(true);
    setError("");
    try {
      const r = await refreshWalletPortfolio(wallet.id);
      if (!r.ok) setError(r.error);
      router.refresh();
    } catch {
      setError("განახლება ვერ მოხერხდა. სცადეთ ხელახლა.");
    } finally {
      setPending(false);
    }
  }
  useEffect(() => {
    if (!started.current && !wallet.snapshot) {
      started.current = true;
      void refresh();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const snapshot = wallet.snapshot,
    stale =
      !!snapshot &&
      (!!wallet.lastError || walletSnapshotStale(snapshot.fetchedAt));
  const nativeSymbol = wallet.network === "stellar" ? "XLM" : "BTC";
  const nativeQuantity = snapshot
    ? quantity(
        snapshot.accounts
          .reduce(
            (sum, account) =>
              sum.plus(
                account.assets.find((asset) => asset.id === "native")
                  ?.quantity ?? 0,
              ),
            decimal(0),
          )
          .toString(),
      )
    : "—";
  const explorer = (address: string) =>
    wallet.network === "stellar"
      ? `https://stellar.expert/explorer/public/account/${address}`
      : `https://mempool.space/address/${address}`;
  return (
    <main
      id="main"
      className="mx-auto min-h-dvh max-w-[960px] space-y-3 p-4 lg:p-5"
    >
      <header className="flex min-w-0 items-center gap-2 border-b border-base-300 pb-3">
        <Link
          href="/portfolios"
          className="btn btn-ghost btn-square shrink-0"
          aria-label="პორტფელები"
          title="პორტფელები"
        >
          <ArrowLeft size={18} />
        </Link>
        <details className="dropdown min-w-0 flex-1">
          <summary className="flex min-h-11 cursor-pointer items-center min-w-0">
            <h1 className="truncate text-base font-semibold">{wallet.name}</h1>
          </summary>
          <div className="dropdown-content z-20 w-56 max-w-[70vw] rounded-box border border-base-300 bg-base-200 p-3 text-sm break-words shadow-lg">
            {wallet.name}
          </div>
        </details>
        <BalancePrivacyToggle />
        <button
          className="btn btn-ghost btn-square shrink-0"
          onClick={refresh}
          disabled={pending}
          aria-busy={pending}
          aria-label="განახლება"
          title="განახლება"
        >
          {pending ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <RefreshCw size={18} />
          )}
        </button>
        <button
          className="btn btn-ghost btn-square shrink-0"
          onClick={() => setEditing(true)}
          disabled={pending}
          aria-label="საფულის მართვა"
          title="საფულის მართვა"
        >
          <Settings2 size={18} />
        </button>
      </header>
      {error && (
        <Message error>
          <div>
            <p>{error}</p>
            {snapshot && <p>ბალანსი ვერ განახლდა. წინა მონაცემები შენარჩუნებულია.</p>}
          </div>
        </Message>
      )}
      {wallet.lastError && !error && <Message>{wallet.lastError}</Message>}
      <section className="card bg-base-200">
        <div className="card-body gap-2 p-4">
          {wallet.network === "stellar" ? (
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium text-base-content/60">XLM</p>
              <p className="overflow-x-auto whitespace-nowrap text-2xl font-semibold tabular-nums sm:text-3xl">
                <BalanceValue>{nativeQuantity}</BalanceValue>
              </p>
              <p className="overflow-x-auto whitespace-nowrap text-lg tabular-nums text-base-content/70">
                <BalanceValue>{money(snapshot?.knownValue)}</BalanceValue>
                <span className="ml-2 text-xs">USD</span>
              </p>
            </div>
          ) : (
            <figure
              className="diff h-28 rounded-box"
              tabIndex={0}
              aria-label={`${nativeSymbol} და დოლარის ღირებულების შედარება`}
            >
              <div className="diff-item-1" tabIndex={0}>
                <div className="flex flex-col items-center justify-center gap-2 bg-primary/15 pr-[50cqi] text-base-content">
                  <span className="text-xs text-base-content/60">
                    {nativeSymbol}
                  </span>
                  <span className="whitespace-nowrap text-sm font-semibold tabular-nums sm:text-xl">
                    <BalanceValue>{nativeQuantity}</BalanceValue>
                  </span>
                </div>
              </div>
              <div className="diff-item-2">
                <div className="flex flex-col items-center justify-center gap-2 bg-base-300 pl-[50cqi] text-base-content">
                  <span className="text-xs text-base-content/60">USD</span>
                  <span className="whitespace-nowrap text-sm font-semibold tabular-nums sm:text-xl">
                    <BalanceValue>{money(snapshot?.knownValue)}</BalanceValue>
                  </span>
                </div>
              </div>
              <div className="diff-resizer" />
            </figure>
          )}
          <details className="dropdown">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-base-content/60">
              <span
                className={`status status-xs ${stale || !snapshot?.complete ? "status-warning" : "status-success"}`}
              />
              {pending
                ? "იტვირთება…"
                : !snapshot
                  ? "მიუწვდომელია"
                  : stale
                    ? "მოძველებულია"
                    : !snapshot.complete
                      ? "არასრული ჯამი"
                      : "განახლებულია"}
            </summary>
            <div className="dropdown-content z-20 w-64 max-w-[75vw] rounded-box border border-base-300 bg-base-200 p-3 text-xs shadow-lg">
              {snapshot && <p>{dateTime(snapshot.fetchedAt)}</p>}
              {stale && <p className="mt-2">განაახლეთ მონაცემები.</p>}
              {snapshot && !snapshot.complete && (
                <p className="mt-2">
                  უცნობი ფასის მქონე აქტივები ჯამში არ შედის.
                </p>
              )}
            </div>
          </details>
        </div>
      </section>
      {wallet.addresses.map((address) => {
        const account = snapshot?.accounts.find((a) => a.address === address);
        return (
          <section
            key={address}
            className="card min-w-0 bg-base-200"
          >
            <div className="card-body gap-3 p-4">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <h2
                  className="min-w-0 font-mono text-xs text-base-content/60"
                  title={address}
                >
                  {address.slice(0, 8)}…{address.slice(-6)}
                </h2>
                <a
                  href={explorer(address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-square shrink-0"
                  aria-label={`${address} — explorer`}
                >
                  <ExternalLink size={16} />
                </a>
              </div>
              {!account ? (
                <p className="text-xs text-base-content/60">
                  {pending ? "ბალანსი იტვირთება…" : "ბალანსი მიუწვდომელია"}
                </p>
              ) : account.state === "unfunded" ? (
                <p className="text-sm text-base-content/60">
                  ანგარიში ჯერ გააქტიურებული არ არის.
                </p>
              ) : (
                <>
                  <ul className="list">
                    {account.assets
                      .filter(
                        (a) =>
                          a.id === "native" ||
                          (a.authorized && decimal(a.quantity).gt(0)),
                      )
                      .sort(
                        (a, b) =>
                          Number(b.id === "native") -
                            Number(a.id === "native") ||
                          Number(b.value !== null) - Number(a.value !== null) ||
                          a.symbol.localeCompare(b.symbol),
                      )
                      .slice(0, expanded[address] ? undefined : 6)
                      .map((a) => (
                        <li
                          key={a.id}
                          className="list-row min-w-0 grid-cols-[1fr_auto] gap-2 border-b border-base-300 px-0 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{a.symbol}</p>
                            <p className="mt-1 overflow-x-auto whitespace-nowrap text-xs tabular-nums text-base-content/60">
                              <BalanceValue>
                                {quantity(a.quantity)}
                              </BalanceValue>
                            </p>
                            {!a.authorized && (
                              <p className="text-xs text-warning">
                                არ არის ავტორიზებული
                              </p>
                            )}
                          </div>
                          <div className="min-w-0 max-w-[45vw] text-right">
                            <p className="overflow-x-auto whitespace-nowrap text-sm tabular-nums">
                              <BalanceValue>{money(a.value)}</BalanceValue>
                            </p>
                          </div>
                        </li>
                      ))}
                  </ul>
                  {account.assets.filter(
                    (a) =>
                      a.id === "native" ||
                      (a.authorized && decimal(a.quantity).gt(0)),
                  ).length > 6 && (
                    <button
                      className="btn btn-ghost w-full"
                      onClick={() =>
                        setExpanded((previous) => ({
                          ...previous,
                          [address]: !previous[address],
                        }))
                      }
                    >
                      {expanded[address]
                        ? "შეკუმშვა"
                        : `ყველა აქტივი (${account.assets.filter((a) => a.id === "native" || (a.authorized && decimal(a.quantity).gt(0))).length})`}
                    </button>
                  )}
                  <details className="collapse collapse-arrow border border-base-300">
                    <summary className="collapse-title min-h-11 py-3 text-xs">
                      დეტალები
                    </summary>
                    <div className="collapse-content space-y-2 text-xs text-base-content/60">
                      <p className="break-all font-mono">{address}</p>
                      {account.assets
                        .filter(
                          (a) =>
                            a.id === "native" ||
                            (a.authorized && decimal(a.quantity).gt(0)),
                        )
                        .map((a) => (
                          <div key={a.id}>
                            <p className="font-semibold">{a.symbol}</p>
                            <p>
                              <BalanceValue>{money(a.price)}</BalanceValue> /{" "}
                              {a.symbol}
                            </p>
                            {a.issuer && (
                              <p className="break-all font-mono text-[10px]">
                                {a.issuer}
                              </p>
                            )}
                          </div>
                        ))}
                      {wallet.network === "bitcoin" &&
                        account.pending !== null && (
                          <p className="text-xs text-base-content/60">
                            მოლოდინში ცვლილება:{" "}
                            <BalanceValue>
                              {quantity(account.pending)} BTC
                            </BalanceValue>
                          </p>
                        )}
                      {wallet.network === "stellar" && (
                        <div className="flex flex-wrap gap-3 text-xs text-base-content/60">
                          <span>
                            რეზერვი:{" "}
                            <BalanceValue>
                              {account.reserve === null
                                ? "—"
                                : `${quantity(account.reserve)} XLM`}
                            </BalanceValue>
                          </span>
                          <span>
                            ხელმისაწვდომი:{" "}
                            <BalanceValue>
                              {account.available === null
                                ? "—"
                                : `${quantity(account.available)} XLM`}
                            </BalanceValue>
                          </span>
                        </div>
                      )}
                      <p>
                        მისამართები და ბალანსები ინახება შენს პორტფელში.
                        განახლებისას საჯარო მისამართებს იღებს{" "}
                        {wallet.network === "stellar"
                          ? "Stellar Horizon"
                          : "mempool.space"}
                        . გასაღებს, seed phrase-ს ან ხელმოწერას არ ვითხოვთ.
                      </p>
                      <p>
                        {wallet.network === "bitcoin"
                          ? "ნაჩვენებია მხოლოდ ჩამოთვლილი მისამართები. სხვა receiving/change მისამართები ავტომატურად არ იძებნება. ჯამში დადასტურებული ბალანსია; მოლოდინში ცვლილება ცალკეა."
                          : "ნაჩვენებია XLM, კლასიკური trustline აქტივები და liquidity pool shares-ის რაოდენობა. Soroban/DeFi და claimable balances არ შედის. ტოკენი განისაზღვრება კოდითა და issuer-ით; უცნობი ფასი არ ითვლება ნულად."}
                      </p>
                      <p>
                        შესყიდვის ისტორიის გარეშე მოგება/ზარალს არ ვითვლით.
                        ღირებულება ინფორმაციულია.
                      </p>
                    </div>
                  </details>
                </>
              )}
            </div>
          </section>
        );
      })}
      <Modal
        open={editing}
        onOpenChange={setEditing}
        title="საფულის მართვა"
        description="საჯარო მისამართები · თითო მისამართი ახალ ხაზზე"
      >
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setPending(true);
            setError("");
            try {
              const r = await updateWalletPortfolio(wallet.id, {
                name: f.get("name"),
                network: wallet.network,
                addresses: String(f.get("addresses"))
                  .split(/\r?\n/)
                  .map((a) => a.trim())
                  .filter(Boolean),
              });
              if (!r.ok) {
                setError(r.error);
                return;
              }
              setEditing(false);
              await refresh();
              router.refresh();
            } catch {
              setError("შენახვა ვერ მოხერხდა.");
            } finally {
              setPending(false);
            }
          }}
        >
          <Field label="პორტფელის სახელი">
            <input
              name="name"
              className="input"
              required
              maxLength={60}
              defaultValue={wallet.name}
            />
          </Field>
          <Field label="საჯარო მისამართები">
            <textarea
              name="addresses"
              className="textarea font-mono"
              rows={4}
              required
              maxLength={1000}
              defaultValue={wallet.addresses.join("\n")}
            />
          </Field>
          {error && <Message error>{error}</Message>}
          <button className="btn btn-primary w-full" disabled={pending}>
            {pending ? "ინახება…" : "შენახვა"}
          </button>
          <button
            type="button"
            className="btn btn-ghost text-error w-full"
            disabled={pending}
            onClick={() => {
              setEditing(false);
              setDeleting(true);
            }}
          >
            პორტფელის წაშლა
          </button>
        </form>
      </Modal>
      <Modal
        open={deleting}
        onOpenChange={setDeleting}
        title="პორტფელის წაშლა"
        description="წაიშლება მხოლოდ აპში შენახული მისამართები და ბალანსები. საფულის აქტივები უცვლელი დარჩება."
      >
        <div className="flex gap-2">
          {error && <Message error>{error}</Message>}
          <button
            className="btn btn-ghost"
            disabled={pending}
            onClick={() => setDeleting(false)}
          >
            გაუქმება
          </button>
          <button
            className="btn btn-error"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                const r = await removeWalletPortfolio(wallet.id);
                if (r.ok) {
                  router.push("/portfolios");
                  router.refresh();
                } else setError(r.error);
              } catch {
                setError("წაშლა ვერ მოხერხდა.");
              } finally {
                setPending(false);
              }
            }}
          >
            წაშლა
          </button>
        </div>
      </Modal>
    </main>
  );
}
