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
export function HistoryChart({
  snapshots,
  illustrative = false,
}: {
  snapshots: Pick<Snapshot, "capturedAt" | "value">[];
  illustrative?: boolean;
}) {
  if (snapshots.length < 2)
    return (
      <div className="flex h-56 flex-col items-center justify-center text-center">
        <p className="text-xs text-muted">ისტორია ჯერ არ არის საკმარისი</p>
        <p className="mt-2 max-w-xs text-[11px] leading-6 text-muted">
          გრაფიკისთვის საჭიროა მინიმუმ ორი შენახული შეფასება. ისტორია
          ყოველდღიურად გროვდება.
        </p>
      </div>
    );
  const points = snapshots.map((s) => ({
    time: Date.parse(s.capturedAt),
    value: Number(s.value),
  }));
  return (
    <div>
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
                <stop offset="0%" stopColor="#aa91ff" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#aa91ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#2b2d38"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="time"
              tickFormatter={(v) => dateTime(Number(v), true)}
              axisLine={false}
              tickLine={false}
              minTickGap={32}
              tick={{ fill: "#8e91a3", fontSize: 10 }}
              dy={8}
            />
            <YAxis
              orientation="right"
              tickFormatter={(v) => money(String(v), true)}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#8e91a3", fontSize: 10 }}
              width={62}
              domain={["auto", "auto"]}
            />
            <Tooltip
              labelFormatter={(v) => dateTime(Number(v))}
              formatter={(v) => [money(String(v)), "ღირებულება"]}
              contentStyle={{
                background: "#1e2028",
                border: "1px solid #393642",
                borderRadius: 10,
                fontSize: 11,
              }}
            />
            <Area
              dataKey="value"
              type="linear"
              stroke="#aa91ff"
              strokeWidth={2}
              fill="url(#historyFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
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
