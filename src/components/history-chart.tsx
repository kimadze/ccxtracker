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
import { useMemo, useState } from "react";
export function HistoryChart({
  snapshots,
  illustrative = false,
}: {
  snapshots: Pick<Snapshot, "capturedAt" | "value">[];
  illustrative?: boolean;
}) {
  const [period, setPeriod] = useState<"7D" | "1M" | "3M" | "1Y" | "ALL">("1M");
  const points = useMemo(() => {
    const days = { "7D": 7, "1M": 30, "3M": 90, "1Y": 365, ALL: Infinity }[
      period
    ];
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
  }, [snapshots, period]);
  if (!snapshots.length)
    return (
      <div className="flex h-56 flex-col items-center justify-center text-center">
        <p className="text-xs text-muted">ისტორია ჯერ არ არის საკმარისი</p>
        <p className="mt-2 max-w-xs text-[11px] leading-6 text-muted">
          პირველი შეფასება ყოველდღიური განახლების შემდეგ გამოჩნდება.
        </p>
      </div>
    );
  return (
    <div>
      <div className="chart-periods" aria-label="გრაფიკის პერიოდი">
        {(["7D", "1M", "3M", "1Y", "ALL"] as const).map((item) => (
          <button
            key={item}
            type="button"
            className={period === item ? "active" : ""}
            onClick={() => setPeriod(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div
        className="h-56 w-full"
        role="img"
        aria-label={
          illustrative
            ? "გამოგონილი ღირებულებების სადემონსტრაციო გრაფიკი"
            : "პორტფელის ღირებულების ისტორია"
        }
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart
            data={points}
            margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="historyFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--violet)"
                  stopOpacity={0.36}
                />
                <stop offset="100%" stopColor="var(--violet)" stopOpacity={0} />
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
              tickFormatter={(v) => money(String(v), true)}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--text-low)", fontSize: 11 }}
              width={62}
              domain={["auto", "auto"]}
            />
            <Tooltip
              labelFormatter={(v) => dateTime(Number(v))}
              formatter={(v) => [money(String(v)), "ღირებულება"]}
              contentStyle={{
                background: "var(--surface-raised)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 11,
              }}
            />
            <Area
              dataKey="value"
              type="linear"
              stroke="var(--violet)"
              strokeWidth={2}
              fill="url(#historyFill)"
              isAnimationActive={false}
              dot={{
                r: snapshots.length === 1 ? 4 : 0,
                fill: "var(--violet)",
                strokeWidth: 0,
              }}
              activeDot={{
                r: 4,
                fill: "var(--violet)",
                stroke: "#e7dcff",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {snapshots.length === 1 && (
        <p className="mt-3 rounded-md border border-brand/15 bg-brand/5 px-3 py-2 text-[10px] leading-5 text-muted">
          საწყისი შეფასება შენახულია. მომდევნო ყოველდღიური შეფასების შემდეგ აქ
          გამოჩნდება ცვლილების ხაზი.
        </p>
      )}
      <details className="mt-3 text-[10px] text-muted">
        <summary>მონაცემების ცხრილი</summary>
        <div className="mt-2 max-h-40 overflow-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">თარიღი</th>
                <th className="text-right">ღირებულება</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.capturedAt}>
                  <td className="py-1">{dateTime(s.capturedAt, true)}</td>
                  <td className="text-right">{money(s.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
