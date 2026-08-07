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
const END_OVERLAY_FADE_START_PROGRESS = 0.2;
const END_OVERLAY_FADE_END_PROGRESS = 0.4;
const OUTRO_OVERLAY_FADE_START_PROGRESS = 0.55;
const OUTRO_OVERLAY_FADE_END_PROGRESS = 0.7;

export function ScrollFrameAnimation({
  children,
  endChildren,
  outroChildren,
}: {
  children?: ReactNode;
  endChildren?: ReactNode;
  outroChildren?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const endOverlayRef = useRef<HTMLDivElement>(null);
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

      const fadeProgress = Math.min(1, clamped / OVERLAY_FADE_END_PROGRESS);

      const overlay = overlayRef.current;
      if (overlay) {
        const opacity = 1 - fadeProgress;
        overlay.style.opacity = String(opacity);
        overlay.style.pointerEvents = opacity === 0 ? "none" : "auto";
      }

      const endOverlay = endOverlayRef.current;
      if (endOverlay) {
        const endFadeRange = END_OVERLAY_FADE_END_PROGRESS - END_OVERLAY_FADE_START_PROGRESS;
        const opacity = Math.min(
          1,
          Math.max(0, (clamped - END_OVERLAY_FADE_START_PROGRESS) / endFadeRange),
        );
        endOverlay.style.opacity = String(opacity);
        endOverlay.style.pointerEvents = opacity === 0 ? "none" : "auto";
      }

      const outroOverlay = outroOverlayRef.current;
      if (outroOverlay) {
        const outroFadeRange = OUTRO_OVERLAY_FADE_END_PROGRESS - OUTRO_OVERLAY_FADE_START_PROGRESS;
        const opacity = Math.min(
          1,
          Math.max(0, (clamped - OUTRO_OVERLAY_FADE_START_PROGRESS) / outroFadeRange),
        );
        outroOverlay.style.opacity = String(opacity);
        outroOverlay.style.pointerEvents = opacity === 0 ? "none" : "auto";
      }
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
          <div className="absolute inset-x-0 bottom-0 p-4 md:inset-auto md:right-[5%] md:bottom-[6%] md:p-0">
            {endChildren}
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
          <div
            ref={endOverlayRef}
            className="absolute inset-x-0 bottom-0 p-4 opacity-0 md:inset-auto md:right-[5%] md:bottom-[6%] md:p-0"
          >
            {endChildren}
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
