import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useHideOnScroll } from "./use-hide-on-scroll";

function setScrollY(y: number) {
  Object.defineProperty(window, "scrollY", { value: y, configurable: true, writable: true });
  window.dispatchEvent(new Event("scroll"));
}

describe("useHideOnScroll", () => {
  beforeEach(() => {
    setScrollY(0);
  });

  it("stays visible while scrolling down but under the reveal threshold", () => {
    const { result } = renderHook(() => useHideOnScroll());

    act(() => setScrollY(80));

    expect(result.current).toBe(false);
  });

  it("hides once scrolled down past the threshold", () => {
    const { result } = renderHook(() => useHideOnScroll());

    act(() => setScrollY(200));

    expect(result.current).toBe(true);
  });

  it("reappears on scroll-up", () => {
    const { result } = renderHook(() => useHideOnScroll());
    act(() => setScrollY(200));
    expect(result.current).toBe(true);

    act(() => setScrollY(100));

    expect(result.current).toBe(false);
  });

  it("ignores sub-threshold jitter so it doesn't flicker", () => {
    const { result } = renderHook(() => useHideOnScroll());
    act(() => setScrollY(200));
    expect(result.current).toBe(true);

    // A 10px settle-back is below the 32px delta threshold — should be
    // ignored, not read as a scroll-up.
    act(() => setScrollY(190));

    expect(result.current).toBe(true);
  });

  it("stays visible while disabled, even past the reveal threshold", () => {
    const { result } = renderHook(() => useHideOnScroll(true));

    act(() => setScrollY(200));

    expect(result.current).toBe(false);
  });

  it("forces visible immediately when disabled while already hidden", () => {
    const { result, rerender } = renderHook(({ disabled }) => useHideOnScroll(disabled), {
      initialProps: { disabled: false },
    });
    act(() => setScrollY(200));
    expect(result.current).toBe(true);

    rerender({ disabled: true });

    expect(result.current).toBe(false);
  });

  describe("under prefers-reduced-motion", () => {
    const originalMatchMedia = globalThis.matchMedia;

    beforeEach(() => {
      globalThis.matchMedia = ((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })) as unknown as typeof window.matchMedia;
    });

    afterEach(() => {
      globalThis.matchMedia = originalMatchMedia;
    });

    it("never hides regardless of scroll", () => {
      const { result } = renderHook(() => useHideOnScroll());

      act(() => setScrollY(400));

      expect(result.current).toBe(false);
    });
  });
});
