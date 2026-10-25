// The dashboard's charts, built on the shadcn chart component. Registered is Dark
// Teal and visitors are Sandy Clay; every chart has a legend or direct labels, and
// the bar charts have a table view for exact numbers.

import type { HourCount, PurposeCount } from "@guardhouse/api-types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { formatHour, purposeLabel } from "../lib/format";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "./chart";

const verdictConfig = {
  registered: { label: "Registered", color: "var(--color-chart-1)" },
  visitor: { label: "Visitors", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

function TableView({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-teal underline">Show as a table</summary>
      <table className="mt-2 w-full text-left">
        <thead className="text-xs text-ink-soft">
          <tr>
            {head.map((h) => (
              <th key={h} className="py-1 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((row) => (
            <tr key={String(row[0])} className="border-t border-line">
              {row.map((cell, i) => (
                <td key={head[i]} className="py-1 pr-4">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Entries per hour, stacked by verdict. */
export function HourlyChart({ data, description }: { data: HourCount[]; description: string }) {
  const rows = data.map((d) => ({ ...d, label: formatHour(d.hour) }));
  const total = data.reduce((n, d) => n + d.registered + d.visitor, 0);
  const busiest = data.reduce(
    (best, d) => (d.registered + d.visitor > best.registered + best.visitor ? d : best),
    data[0] ?? { hour: 0, registered: 0, visitor: 0 },
  );
  const summary =
    total === 0
      ? "No entries yet."
      : `Busiest at ${formatHour(busiest.hour)}, with ${busiest.registered + busiest.visitor} entries.`;

  return (
    <figure className="flex flex-col gap-3">
      <ChartContainer
        config={verdictConfig}
        className="aspect-auto h-64 w-full"
        role="img"
        aria-label={`${description} ${summary}`}
      >
        <BarChart data={rows} margin={{ left: 0, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={2} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="registered" stackId="verdict" fill="var(--color-registered)" />
          <Bar
            dataKey="visitor"
            stackId="verdict"
            fill="var(--color-visitor)"
            radius={[3, 3, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
      <figcaption className="text-sm text-ink-soft">{summary}</figcaption>
      <TableView
        head={["Hour", "Registered", "Visitors"]}
        rows={rows
          .filter((r) => r.registered + r.visitor > 0)
          .map((r) => [r.label, r.registered, r.visitor])}
      />
    </figure>
  );
}

/** A half ring: registered against visitors. */
export function VerdictArc({ registered, visitors }: { registered: number; visitors: number }) {
  const total = registered + visitors;
  const share = total ? Math.round((registered / total) * 100) : 0;
  const data = total
    ? [
        { verdict: "registered", value: registered, fill: "var(--color-registered)" },
        { verdict: "visitor", value: visitors, fill: "var(--color-visitor)" },
      ]
    : [{ verdict: "none", value: 1, fill: "var(--color-muted)" }];

  return (
    <figure className="flex flex-col items-center gap-3">
      <ChartContainer
        config={verdictConfig}
        className="aspect-[2/1] w-full max-w-72"
        role="img"
        aria-label={`${registered} registered and ${visitors} visitors today.`}
      >
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="verdict"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius="68%"
            outerRadius="100%"
            stroke="none"
            isAnimationActive={false}
          />
        </PieChart>
      </ChartContainer>
      <figcaption className="flex flex-col items-center gap-2 text-sm">
        <span className="text-2xl font-semibold tabular-nums">
          {total ? `${share}% registered` : "No entries yet"}
        </span>
        <span className="flex gap-4 text-ink-soft">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-chart-1" /> {registered} registered
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-chart-2" /> {visitors} visitors
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

const purposeConfig = {
  count: { label: "Visitors", color: "var(--color-chart-2)" },
} satisfies ChartConfig;

/** Visitors by purpose, most first, with the count written on each bar. */
export function PurposeBars({ data, description }: { data: PurposeCount[]; description: string }) {
  const rows = data.map((d) => ({ ...d, label: purposeLabel(d.purpose) }));
  return (
    <figure className="flex flex-col gap-3">
      <ChartContainer
        config={purposeConfig}
        className="aspect-auto h-48 w-full"
        role="img"
        aria-label={`${description} ${rows.map((r) => `${r.label} ${r.count}`).join(", ")}.`}
      >
        <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 40 }}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={72} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="count" fill="var(--color-count)" radius={4}>
            <LabelList dataKey="count" position="right" className="fill-foreground" />
          </Bar>
        </BarChart>
      </ChartContainer>
      <TableView head={["Purpose", "Visitors"]} rows={rows.map((r) => [r.label, r.count])} />
    </figure>
  );
}

const sparkConfig = {
  entries: { label: "Entries", color: "var(--color-chart-1)" },
} satisfies ChartConfig;

/** A small line of entries per day, oldest first. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const data = values.map((entries, day) => ({ day, entries }));
  return (
    <ChartContainer
      config={sparkConfig}
      className="aspect-auto h-10 w-32"
      role="img"
      aria-label={label}
    >
      <LineChart data={data} margin={{ top: 4, bottom: 4, left: 2, right: 2 }}>
        <Line
          dataKey="entries"
          type="monotone"
          stroke="var(--color-entries)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
