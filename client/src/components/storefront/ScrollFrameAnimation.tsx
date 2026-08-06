import { useEffect, useRef } from "react";

const FRAME_COUNT = 270;
const FRAME_PATH = (index: number) =>
  `/scroll-frames/ezgif-frame-${String(index).padStart(3, "0")}.jpg`;

// One scroll-height "page" of runway per frame step, capped so the section
// doesn't demand an absurd amount of scrolling on very tall viewports.
const SCROLL_HEIGHT_VH = 400;

export function ScrollFrameAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
      <div ref={containerRef} className="h-screen w-full">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ height: `${SCROLL_HEIGHT_VH}vh` }} className="relative">
      <div className="sticky top-0 h-screen w-full">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
    </div>
  );
}
