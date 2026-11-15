import { useEffect, useRef } from "react";

/**
 * Decorative screen-space specks.
 * They are not sky coordinates, not catalog stars, and they are never drawn inside the sphere.
 */

const SPECKS = 48;

function speck(index: number): { x: number; y: number; r: number } {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  const fraction = value - Math.floor(value);
  const value2 = Math.sin(index * 78.233) * 12345.6789;
  const fraction2 = value2 - Math.floor(value2);
  return { x: fraction, y: fraction2, r: 0.6 + (index % 3) * 0.25 };
}

export function ScreenDust({ paused, color }: { paused: boolean; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    let frame = 0;
    let stopped = false;

    const draw = (time: number) => {
      if (stopped) return;
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const drift = paused ? 0 : time * 0.000004;
      for (let index = 0; index < SPECKS; index += 1) {
        const point = speck(index);
        const x = ((point.x + drift * (index % 5)) % 1) * width;
        const y = point.y * height;
        const dx = (x - width / 2) / (width / 2);
        const dy = (y - height / 2) / (height / 2);
        if (dx * dx + dy * dy < 0.62) continue;
        context.globalAlpha = 0.35;
        context.fillStyle = color;
        context.beginPath();
        context.arc(x, y, point.r, 0, Math.PI * 2);
        context.fill();
      }
      if (!paused) frame = window.requestAnimationFrame(draw);
    };

    draw(0);
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
    };
  }, [paused, color]);

  return <canvas ref={canvasRef} className="sky3d-dust" aria-hidden="true" />;
}
