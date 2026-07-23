import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, beforeAll, vi } from "vitest";
import SoldOutChart, { type SoldOutPoint } from "./SoldOutChart";

// jsdom has no ResizeObserver; recharts' ResponsiveContainer skips sizing
// itself without one and never fires its width/height update, but still
// renders its children regardless — this stub just lets it settle on a
// realistic size instead of the default -1x-1.
beforeAll(() => {
  class ResizeObserverStub {
    private callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback(
        [{ target, contentRect: { width: 800, height: 256 } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
});

function buildSeries(overrides: Partial<Record<string, number | null>> = {}): SoldOutPoint[] {
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date("2026-07-22T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
  return dates.map((date) => ({ date, soldOutCount: overrides[date] ?? 0 }));
}

describe("SoldOutChart", () => {
  it("shows a loading skeleton while series is null", () => {
    const { container } = render(<SoldOutChart series={null} trackingStartDate={null} />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
  });

  it("shows a no-data message when tracking has never run", () => {
    render(<SoldOutChart series={buildSeries()} trackingStartDate={null} />);
    expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
  });

  it("shows a tracking-started caption when history is partial", () => {
    const series = buildSeries();
    // Only the last 4 days have a real recorded count; earlier days are null.
    for (const point of series.slice(0, -4)) point.soldOutCount = null;
    render(<SoldOutChart series={series} trackingStartDate={series.at(-4)!.date} />);
    expect(screen.getByText(/tracking started 2026-07-19/i)).toBeInTheDocument();
  });

  it("renders the chart with no caption once a full 30 days of history exists", () => {
    const series = buildSeries();
    render(<SoldOutChart series={series} trackingStartDate={series[0].date} />);
    expect(screen.queryByText(/tracking started/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no data yet/i)).not.toBeInTheDocument();
  });

  it("calls onDayClick with the clicked day's date", () => {
    const series = buildSeries();
    series.at(-1)!.soldOutCount = 5; // recharts only renders a rect for a nonzero bar
    const onDayClick = vi.fn();
    const { container } = render(
      <SoldOutChart series={series} trackingStartDate={series[0].date} onDayClick={onDayClick} />,
    );
    const bars = container.querySelectorAll(".recharts-bar-rectangle path");
    expect(bars.length).toBe(1);
    fireEvent.click(bars[0]);
    expect(onDayClick).toHaveBeenCalledWith(series.at(-1)!.date);
  });

  it("ignores a click on a bar dated before trackingStartDate", () => {
    // Contrived on purpose: this can't happen via the real UI (the server
    // never emits a nonzero value before its own trackingStartDate), but the
    // component guards against a caller passing a mismatched prop anyway.
    const series = buildSeries();
    series[0].soldOutCount = 3;
    const onDayClick = vi.fn();
    const { container } = render(
      <SoldOutChart series={series} trackingStartDate={series.at(-1)!.date} onDayClick={onDayClick} />,
    );
    const bars = container.querySelectorAll(".recharts-bar-rectangle path");
    expect(bars.length).toBe(1);
    fireEvent.click(bars[0]);
    expect(onDayClick).not.toHaveBeenCalled();
  });
});
