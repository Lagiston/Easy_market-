import { useEffect, useRef, type ReactNode } from "react";

const FRAME_COUNT = 270;
const FRAME_PATH = (index: number) =>
  `/scroll-frames/ezgif-frame-${String(index).padStart(3, "0")}.jpg`;

// One scroll-height "page" of runway per frame step, capped so the section
// doesn't demand an absurd amount of scrolling on very tall viewports.
const SCROLL_HEIGHT_VH = 400;

// The headline overlay fades out over the first slice of scroll progress so
// the frames get full attention once real scrubbing kicks in. The end-side
// overlay only starts fading in once the headline is fully gone, then stays
// visible — sequential, not a cross-fade. The outro overlay (left side again)
// only fades in near the very end of the scrub, as a closing line just before
// the section releases its scroll-jacking and the page moves on.
const OVERLAY_FADE_END_PROGRESS = 0.2;
// The intro card's four pieces reveal one after another within the same
// 0.2–0.4 window the whole card used to fade in as one block, each on its
// own slightly-overlapping slice (overlap keeps the reveal feeling fluid
// rather than four hard snaps).
const END_EYEBROW_FADE = [0.2, 0.26] as const;
const END_HEADLINE_FADE = [0.24, 0.3] as const;
const END_BODY_FADE = [0.28, 0.34] as const;
const END_CTA_FADE = [0.32, 0.4] as const;
const OUTRO_OVERLAY_FADE_START_PROGRESS = 0.55;
const OUTRO_OVERLAY_FADE_END_PROGRESS = 0.7;

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

export function ScrollFrameAnimation({
  children,
  endChildren,
  outroChildren,
}: {
  children?: ReactNode;
  endChildren?: {
    eyebrow: ReactNode;
    headline: ReactNode;
    body: ReactNode;
    cta: ReactNode;
  };
  outroChildren?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const endEyebrowRef = useRef<HTMLDivElement>(null);
  const endHeadlineRef = useRef<HTMLDivElement>(null);
  const endBodyRef = useRef<HTMLDivElement>(null);
  const endCtaRef = useRef<HTMLDivElement>(null);
  const outroOverlayRef = useRef<HTMLDivElement>(null);
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

        const scale = Math.min(cssWidth / img.naturalWidth, cssHeight / img.naturalHeight);
        const drawWidth = img.naturalWidth * scale;
        const drawHeight = img.naturalHeight * scale;
        ctx.drawImage(
          img,
          (cssWidth - drawWidth) / 2,
          (cssHeight - drawHeight) / 2,
          drawWidth,
          drawHeight,
        );
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

      // "contain" fit: show the full frame edge to edge, no cropping and no
      // scaling past 1:1 relative to the source's own aspect ratio.
      const scale = Math.min(cssWidth / img.naturalWidth, cssHeight / img.naturalHeight);
      const drawWidth = img.naturalWidth * scale;
      const drawHeight = img.naturalHeight * scale;
      const offsetX = (cssWidth - drawWidth) / 2;
      const offsetY = (cssHeight - drawHeight) / 2;

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

      applyOpacity(endEyebrowRef.current, computeFadeOpacity(clamped, ...END_EYEBROW_FADE));
      applyOpacity(endHeadlineRef.current, computeFadeOpacity(clamped, ...END_HEADLINE_FADE));
      applyOpacity(endBodyRef.current, computeFadeOpacity(clamped, ...END_BODY_FADE));
      applyOpacity(endCtaRef.current, computeFadeOpacity(clamped, ...END_CTA_FADE));

      applyOpacity(
        outroOverlayRef.current,
        computeFadeOpacity(
          clamped,
          OUTRO_OVERLAY_FADE_START_PROGRESS,
          OUTRO_OVERLAY_FADE_END_PROGRESS,
        ),
      );
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
      <div ref={containerRef} className="relative h-screen w-full">
        <canvas ref={canvasRef} className="h-full w-full" />
        {children && (
          <div className="absolute inset-y-0 start-0 flex w-full max-w-xl items-center p-8 md:p-16">
            {children}
          </div>
        )}
        {endChildren && (
          <div className="absolute inset-x-0 bottom-0 w-full p-4 md:inset-auto md:right-[5%] md:bottom-[6%] md:w-[380px] md:p-0">
            <div>{endChildren.eyebrow}</div>
            <div>{endChildren.headline}</div>
            <div>{endChildren.body}</div>
            <div>{endChildren.cta}</div>
          </div>
        )}
        {outroChildren && (
          <div className="absolute inset-x-0 top-0 flex w-full max-w-xl items-start p-6 md:inset-y-0 md:items-center md:p-16">
            {outroChildren}
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ height: `${SCROLL_HEIGHT_VH}vh` }} className="relative">
      <div className="sticky top-0 h-screen w-full animate-[navbar-enter_0.6s_ease-out_0.15s_both] motion-reduce:animate-none">
        <canvas ref={canvasRef} className="h-full w-full" />
        {children && (
          <div
            ref={overlayRef}
            className="absolute inset-y-0 start-0 flex w-full max-w-xl items-center p-8 md:p-16"
          >
            {children}
          </div>
        )}
        {endChildren && (
          <div className="absolute inset-x-0 bottom-0 w-full p-4 md:inset-auto md:right-[5%] md:bottom-[6%] md:w-[380px] md:p-0">
            <div ref={endEyebrowRef} className="opacity-0">
              {endChildren.eyebrow}
            </div>
            <div ref={endHeadlineRef} className="opacity-0">
              {endChildren.headline}
            </div>
            <div ref={endBodyRef} className="opacity-0">
              {endChildren.body}
            </div>
            <div ref={endCtaRef} className="opacity-0">
              {endChildren.cta}
            </div>
          </div>
        )}
        {outroChildren && (
          <div
            ref={outroOverlayRef}
            className="absolute inset-x-0 top-0 flex w-full max-w-xl items-start p-6 opacity-0 md:inset-y-0 md:items-center md:p-16"
          >
            {outroChildren}
          </div>
        )}
      </div>
    </div>
  );
}
