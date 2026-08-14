import { useEffect, useRef, type ReactNode } from "react";

const FRAME_COUNT = 270;
const FRAME_PATH = (index: number) =>
  `/scroll-frames/ezgif-frame-${String(index).padStart(3, "0")}.jpg`;

// "cover" fit anchored at background-position: center 22% — fills the full
// canvas edge to edge (cropping overflow) instead of letterboxing, matching
// CSS background-position's own formula: offset = (containerSize -
// scaledImageSize) * focal fraction.
const FOCAL_Y = 0.22;

function coverDrawRect(cssWidth: number, cssHeight: number, imgWidth: number, imgHeight: number) {
  const scale = Math.max(cssWidth / imgWidth, cssHeight / imgHeight);
  const drawWidth = imgWidth * scale;
  const drawHeight = imgHeight * scale;
  return {
    drawWidth,
    drawHeight,
    offsetX: (cssWidth - drawWidth) * 0.5,
    offsetY: (cssHeight - drawHeight) * FOCAL_Y,
  };
}

// One scroll-height "page" of runway per frame step, capped so the section
// doesn't demand an absurd amount of scrolling on very tall viewports.
const SCROLL_HEIGHT_VH = 400;

// The headline overlay fades out over the first slice of scroll progress so
// the frames get full attention once real scrubbing kicks in. The
// left-center "Our story" card only starts fading in once the headline is
// fully gone, then stays visible — sequential, not a cross-fade (the two
// occupy the same screen position but never overlap in time). The
// bottom-right pillars only start fading in once the card has finished
// fading in, for a smooth staggered reveal rather than everything landing
// at once.
const OVERLAY_FADE_END_PROGRESS = 0.2;
const END_OVERLAY_FADE = [0.2, 0.4] as const;
// Each pillar reveals one after another within the [0.4, 0.6] window the
// group used to fade in as one block, each on its own slightly-overlapping
// slice (overlap keeps the reveal feeling fluid rather than three hard
// snaps) — matches the "One brand" → "Every category" → "Infinite ways to
// wear it" reading order.
const PILLAR_ITEM_FADES = [
  [0.4, 0.48],
  [0.46, 0.54],
  [0.52, 0.6],
] as const;

// Shared linear-interpolation clamp used by every fade slot below — how far
// `clamped` (0–1 scroll progress) has moved through a [start, end] window.
function computeFadeOpacity(clamped: number, start: number, end: number) {
  return Math.min(1, Math.max(0, (clamped - start) / (end - start)));
}

function applyOpacity(el: HTMLElement | null, opacity: number) {
  if (!el) return;
  el.style.opacity = String(opacity);
  el.style.pointerEvents = opacity === 0 ? "none" : "auto";
}

// Two-layer scrim so the headline stays legible over the photo and the
// photo's bottom edge blends into the page background instead of cutting
// off hard — a horizontal fade (left, where the headline sits, to
// transparent) plus a vertical fade into the page's own background color.
function HeroScrim() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-0 transition-[background] duration-300 motion-reduce:transition-none"
        style={{ background: "var(--hero-scrim-x)" }}
      />
      <div
        className="absolute inset-0 transition-[background] duration-300 motion-reduce:transition-none"
        style={{ background: "var(--hero-scrim-y)" }}
      />
    </div>
  );
}

export function ScrollFrameAnimation({
  children,
  endChildren,
  pillarsChildren,
}: {
  children?: ReactNode;
  endChildren?: ReactNode;
  pillarsChildren?: ReactNode[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const endOverlayRef = useRef<HTMLDivElement>(null);
  const pillarItemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(
    typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const reducedMotion = reducedMotionRef.current;

    // Respect prefers-reduced-motion: load and draw a single static frame,
    // no scroll-driven scrubbing and no extra scroll runway.
    if (reducedMotion) {
      const img = new Image();
      img.src = FRAME_PATH(1);
      imagesRef.current = [img];

      const drawStatic = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || !img.complete || img.naturalWidth === 0) return;

        const dpr = window.devicePixelRatio || 1;
        const cssWidth = canvas.clientWidth;
        const cssHeight = canvas.clientHeight;
        canvas.width = Math.round(cssWidth * dpr);
        canvas.height = Math.round(cssHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const { drawWidth, drawHeight, offsetX, offsetY } = coverDrawRect(
          cssWidth,
          cssHeight,
          img.naturalWidth,
          img.naturalHeight,
        );
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      };

      if (img.complete) drawStatic();
      else img.addEventListener("load", drawStatic, { once: true });
      window.addEventListener("resize", drawStatic);

      return () => window.removeEventListener("resize", drawStatic);
    }

    const images: HTMLImageElement[] = [];
    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new Image();
      img.src = FRAME_PATH(i);
      images.push(img);
    }
    imagesRef.current = images;

    const draw = (frame: number) => {
      const canvas = canvasRef.current;
      const img = imagesRef.current[frame - 1];
      if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const cssWidth = canvas.clientWidth;
      const cssHeight = canvas.clientHeight;
      const pixelWidth = Math.round(cssWidth * dpr);
      const pixelHeight = Math.round(cssHeight * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const { drawWidth, drawHeight, offsetX, offsetY } = coverDrawRect(
        cssWidth,
        cssHeight,
        img.naturalWidth,
        img.naturalHeight,
      );
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    };

    const updateFrame = () => {
      rafRef.current = null;
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const scrollableHeight = container.offsetHeight - window.innerHeight;
      const progress = scrollableHeight > 0 ? -rect.top / scrollableHeight : 0;
      const clamped = Math.min(1, Math.max(0, progress));

      const frame = Math.min(
        FRAME_COUNT,
        Math.max(1, Math.round(clamped * (FRAME_COUNT - 1)) + 1),
      );
      currentFrameRef.current = frame;
      draw(frame);

      applyOpacity(
        overlayRef.current,
        1 - computeFadeOpacity(clamped, 0, OVERLAY_FADE_END_PROGRESS),
      );

      applyOpacity(endOverlayRef.current, computeFadeOpacity(clamped, ...END_OVERLAY_FADE));
      PILLAR_ITEM_FADES.forEach(([start, end], i) => {
        applyOpacity(pillarItemRefs.current[i] ?? null, computeFadeOpacity(clamped, start, end));
      });
    };

    const onScrollOrResize = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(updateFrame);
    };

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    const firstImage = images[0];
    if (firstImage.complete) {
      updateFrame();
    } else {
      firstImage.addEventListener("load", updateFrame, { once: true });
    }

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (reducedMotionRef.current) {
    return (
      <div
        ref={containerRef}
        className="relative h-screen w-full rounded-b-3xl shadow-[0_20px_35px_-15px_rgba(11,31,51,0.4)] dark:shadow-[0_20px_35px_-15px_rgba(11,31,51,0.65)]"
      >
        {/* Photo/canvas clipping lives on this inner wrapper, not the outer
            box — box-shadow is clipped by overflow-hidden on the same
            element, so the "dark arctic-paradise" shadow below has to sit
            on an unclipped ancestor instead. */}
        <div className="absolute inset-0 overflow-hidden rounded-b-3xl">
          <canvas ref={canvasRef} className="h-full w-full" />
          <HeroScrim />
        </div>
        {children && (
          <div className="absolute inset-y-0 start-0 flex w-full max-w-2xl items-center px-8 pt-30 pb-15 md:px-16">
            {children}
          </div>
        )}
        {(endChildren || pillarsChildren) && (
          <div className="absolute inset-x-0 bottom-0 flex w-full flex-col items-center gap-4 p-4 md:contents">
            {endChildren && (
              <div className="w-full md:absolute md:inset-auto md:top-1/2 md:right-0 md:block md:w-auto md:-translate-y-1/2">
                {endChildren}
              </div>
            )}
            {pillarsChildren && pillarsChildren.length > 0 && (
              <div className="w-full space-y-4 md:absolute md:inset-auto md:bottom-[6%] md:left-0 md:block md:w-auto">
                {pillarsChildren.map((pillar, i) => (
                  <div key={i}>{pillar}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ height: `${SCROLL_HEIGHT_VH}vh` }} className="relative">
      <div className="sticky top-0 flex h-screen w-full items-center rounded-b-3xl shadow-[0_20px_35px_-15px_rgba(11,31,51,0.4)] animate-[navbar-enter_0.6s_ease-out_0.15s_both] motion-reduce:animate-none dark:shadow-[0_20px_35px_-15px_rgba(11,31,51,0.65)]">
        {/* Same clip-on-inner-wrapper split as the reduced-motion branch
            above, so the box-shadow isn't clipped by the photo's own
            overflow-hidden. */}
        <div className="absolute inset-0 overflow-hidden rounded-b-3xl">
          <canvas ref={canvasRef} className="h-full w-full" />
          <HeroScrim />
        </div>
        {children && (
          <div
            ref={overlayRef}
            className="absolute inset-y-0 start-0 flex w-full max-w-2xl items-center px-8 pt-30 pb-15 md:px-16"
          >
            {children}
          </div>
        )}
        {(endChildren || pillarsChildren) && (
          <div className="absolute inset-x-0 bottom-0 flex w-full flex-col items-center gap-4 p-4 md:contents">
            {endChildren && (
              <div
                ref={endOverlayRef}
                className="w-full opacity-0 md:absolute md:inset-auto md:top-1/2 md:right-0 md:block md:w-auto md:-translate-y-1/2"
              >
                {endChildren}
              </div>
            )}
            {pillarsChildren && pillarsChildren.length > 0 && (
              <div className="w-full space-y-4 md:absolute md:inset-auto md:bottom-[6%] md:left-0 md:block md:w-auto">
                {pillarsChildren.map((pillar, i) => (
                  <div
                    key={i}
                    ref={(el) => {
                      pillarItemRefs.current[i] = el;
                    }}
                    className="opacity-0"
                  >
                    {pillar}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
