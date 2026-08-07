import { useEffect, useRef, useState } from "react";

// Chromium's wheel-to-smooth-scroll animation can overshoot and settle back
// by ~10-15px after a single flick — the threshold needs enough headroom
// above that noise floor to not misread a momentum correction as a
// direction reversal.
const SCROLL_HIDE_DELTA_THRESHOLD = 32;
// Only hide once scrolled past a typical sticky nav's own height, so it
// doesn't disappear the instant the page starts moving.
const SCROLL_HIDE_MIN_Y = 120;

// Shared by SiteHeader.tsx and Layout.tsx — hides on scroll-down, reappears
// on any scroll-up, skipped entirely under prefers-reduced-motion (checked
// once at mount). `disabled` additionally forces the nav visible and skips
// the hide logic without touching the reduced-motion check — used by
// SiteHeader to keep the header visible while its mobile menu sheet is open
// (the sheet's own trigger button lives inside the header).
export function useHideOnScroll(disabled = false) {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(0);
  const reducedMotionRef = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (!reducedMotionRef.current && !disabled) {
        const delta = y - lastScrollY.current;
        // Ignore sub-threshold jitter — see SCROLL_HIDE_DELTA_THRESHOLD.
        if (Math.abs(delta) > SCROLL_HIDE_DELTA_THRESHOLD) {
          if (delta > 0 && y > SCROLL_HIDE_MIN_Y) {
            setHidden(true);
          } else if (delta < 0) {
            setHidden(false);
          }
          lastScrollY.current = y;
        }
      } else {
        lastScrollY.current = y;
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [disabled]);

  useEffect(() => {
    if (disabled) setHidden(false);
  }, [disabled]);

  return hidden;
}
