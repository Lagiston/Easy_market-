import type { BarRectangleItem } from "recharts";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

export type SoldOutPoint = { date: string; soldOutCount: number | null };

export default function SoldOutChart({
  series,
  trackingStartDate,
  onDayClick,
}: {
  series: SoldOutPoint[] | null;
  trackingStartDate: string | null;
  onDayClick?: (date: string) => void;
}) {
  if (series === null) return <Skeleton className="h-64 w-full" />;

  if (trackingStartDate === null) {
    return (
      <p className="flex h-64 items-center justify-center text-center text-sm text-muted-foreground">
        No data yet — the daily snapshot job hasn't recorded a sold-out count.
        <br />
        Check back after it's run at least once.
      </p>
    );
  }

  // Days before tracking began are zero-filled as `null` (server-side) so
  // they can be visually distinguished from a confirmed zero — otherwise
  // "no data recorded" and "recorded zero" are indistinguishable in a bar
  // chart, since neither renders a visible bar.
  const firstTrackedIndex = series.findIndex((point) => point.date >= trackingStartDate);
  const isPartialHistory = firstTrackedIndex > 0;

  // Recharts only renders a rectangle for a bar with a nonzero value, so
  // click handling naturally only applies to days with something to click —
  // this guard is defense-in-depth against a caller passing a mismatched
  // trackingStartDate rather than something reachable through the UI.
  const handleBarClick = (bar: BarRectangleItem) => {
    const point = bar.payload as SoldOutPoint | undefined;
    if (!onDayClick || !point || point.date < trackingStartDate) return;
    onDayClick(point.date);
  };

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={256}>
        <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          {isPartialHistory && (
            <ReferenceArea
              x1={series[0].date}
              x2={series[firstTrackedIndex].date}
              fill="var(--muted)"
              fillOpacity={0.6}
              ifOverflow="visible"
            />
          )}
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => d.slice(5)}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--popover-foreground)",
            }}
            labelFormatter={(d) => d}
            formatter={(value) => [value === null ? "No data" : value, "Sold out"]}
          />
          <Bar
            dataKey="soldOutCount"
            fill="var(--primary)"
            radius={[4, 4, 0, 0]}
            maxBarSize={20}
            onClick={handleBarClick}
            style={{ cursor: onDayClick ? "pointer" : undefined }}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
      {isPartialHistory && (
        <p className="text-xs text-muted-foreground">
          Tracking started {trackingStartDate} — the shaded region has no data yet.
        </p>
      )}
    </div>
  );
}
