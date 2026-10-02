"use client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money, dateTime } from "@/lib/formatters";
import type { Snapshot } from "@/domain/analytics";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useBalancesHidden } from "./balance-privacy";
import { BalanceValue } from "./ui";
export function HistoryChart({
  snapshots,
  illustrative = false,
  showPeriodControls = true,
  emptyAction,
  compact = false,
}: {
  snapshots: Pick<Snapshot, "capturedAt" | "value">[];
  illustrative?: boolean;
  showPeriodControls?: boolean;
  emptyAction?: ReactNode;
  compact?: boolean;
}) {
  const [period, setPeriod] = useState<
    "1D" | "7D" | "1M" | "3M" | "1Y" | "ALL"
  >("1M");
  const balancesHidden = useBalancesHidden();
  const chartRef = useRef<HTMLDivElement>(null);
  const [hasChartWidth, setHasChartWidth] = useState(false);
  useEffect(() => {
    const element = chartRef.current;
    if (!element) return;
    const update = () =>
      setHasChartWidth(element.clientWidth > 0 && element.clientHeight > 0);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [snapshots.length, period]);
  const points = useMemo(() => {
    const days = showPeriodControls
      ? { "1D": 1, "7D": 7, "1M": 30, "3M": 90, "1Y": 365, ALL: Infinity }[
          period
        ]
      : Infinity;
    const last = Math.max(
      0,
      ...snapshots.map((item) => Date.parse(item.capturedAt)),
    );
    return snapshots
      .filter(
        (item) =>
          days === Infinity ||
          Date.parse(item.capturedAt) >= last - days * 86400000,
      )
      .map((s) => ({
        time: Date.parse(s.capturedAt),
        value: Number(s.value),
      }));
  }, [snapshots, period, showPeriodControls]);
  if (!snapshots.length)
    return (
      <div className={compact ? "py-2 text-left" : "py-4 text-left"}>
        <p className="text-xs text-muted">ისტორია ჯერ არ არის საკმარისი</p>
        {!compact && (
          <p className="mt-2 max-w-xs text-[11px] leading-6 text-muted">
            მიმდინარე შეფასება ავტომატურად შეინახება და ყოველდღიური განახლებები
            მას გააგრძელებს.
          </p>
        )}
        {emptyAction && <div className="mt-4">{emptyAction}</div>}
      </div>
    );
  return (
    <div>
      {showPeriodControls && snapshots.length >= 2 && (
        <div
          className="tabs tabs-box mb-1 flex flex-wrap"
          role="group"
          aria-label="გრაფიკის პერიოდი"
        >
          {(["1D", "7D", "1M", "3M", "1Y", "ALL"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={period === item}
              className={`tab min-h-11 min-w-11 px-2 ${period === item ? "tab-active" : ""}`}
              onClick={() => setPeriod(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}
      {points.length < 2 && (
        <p role="status" className="mb-2 text-xs text-muted">
          {points.length
            ? "ხაზი გამოჩნდება მეორე შეფასების შენახვის შემდეგ."
            : "ამ პერიოდისთვის შეფასებები არ მოიძებნა."}
        </p>
      )}
      <div
        ref={chartRef}
        className={
          points.length < 2
            ? "hidden"
            : compact
              ? "h-[140px] w-full min-w-0 lg:h-[220px]"
              : "h-56 w-full min-w-0"
        }
        role="img"
        aria-label={
          illustrative
            ? "გამოგონილი ღირებულებების სადემონსტრაციო გრაფიკი"
            : "პორტფელის ღირებულების ისტორია"
        }
      >
        {hasChartWidth && (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart
              data={points}
              margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="historyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--accent)"
                    stopOpacity={0.23}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--accent)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--border-soft)"
                strokeDasharray="3 5"
              />
              <XAxis
                dataKey="time"
                tickFormatter={(v) => dateTime(Number(v), true)}
                axisLine={false}
                tickLine={false}
                minTickGap={32}
                tick={{ fill: "var(--text-low)", fontSize: 11 }}
                dy={8}
              />
              <YAxis
                orientation="right"
                tickFormatter={(v) => balancesHidden ? "••••" : money(String(v), true)}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--text-low)", fontSize: 11 }}
                width={80}
                domain={["auto", "auto"]}
              />
              <Tooltip
                labelFormatter={(v) => dateTime(Number(v))}
                formatter={(v) => [balancesHidden ? "••••••" : money(String(v)), "ღირებულება"]}
                contentStyle={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--ccx-border)",
                  borderRadius: 10,
                  fontSize: 11,
                }}
              />
              <Area
                dataKey="value"
                type="linear"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="url(#historyFill)"
                isAnimationActive={false}
                dot={{
                  r: points.length === 1 ? 4 : 0,
                  fill: "var(--accent)",
                  strokeWidth: 0,
                }}
                activeDot={{ r: 4, fill: "var(--accent)", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      {snapshots.length >= 2 && <details className="mt-3 text-[10px] text-muted">
        <summary>მონაცემების ცხრილი</summary>
        <div className="mt-2 max-h-40 overflow-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th className="text-left">თარიღი</th>
                <th className="text-right">ღირებულება</th>
              </tr>
            </thead>
            <tbody>
              {snapshots
                .filter((s) =>
                  points.some(
                    (point) => point.time === Date.parse(s.capturedAt),
                  ),
                )
                .map((s) => (
                  <tr key={s.capturedAt}>
                    <td className="py-1">{dateTime(s.capturedAt, true)}</td>
                    <td className="text-right"><BalanceValue>{money(s.value)}</BalanceValue></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>}
    </div>
  );
}
