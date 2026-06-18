import { useRef, useEffect } from "react";

// Mouse glow — an organic morphing blob that follows the cursor, its colour tied
// to movement speed. Five blurred layers melt into one seamless haze. Fixed,
// pointer-events-none, sits behind everything; respects reduced-motion.
export function MouseGlow() {
  const canvasRef = useRef(null);
  const raf = useRef(null);

  useEffect(() => {
    // Respect reduced-motion: no animated cursor glow for those who opt out.
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let w = window.innerWidth, h = window.innerHeight;

    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w; canvas.height = h;
    };
    resize();
    window.addEventListener("resize", resize);

    // State
    const pos = { x: -999, y: -999 };      // actual mouse
    const smooth = { x: -999, y: -999 };   // smoothed position for drawing
    let hue = 260;                           // current displayed hue
    let targetHue = 260;                     // hue we're drifting toward (set on move)
    let speed = 0;                           // mouse speed magnitude
    let prevX = -999, prevY = -999;

    // Blob: 8 control points around the glow, each with their own phase offset
    const N = 8;
    const phases = Array.from({ length: N }, (_, i) => (i / N) * Math.PI * 2);
    const phaseOffsets = Array.from({ length: N }, () => Math.random() * Math.PI * 2);
    const ampOffsets = Array.from({ length: N }, () => Math.random() * Math.PI * 2);

    let frame = 0;

    const onMove = (e) => {
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      speed = Math.sqrt(dx * dx + dy * dy); // pixels moved this event
      prevX = e.clientX; prevY = e.clientY;
      pos.x = e.clientX; pos.y = e.clientY;
      // Color advances proportionally to speed
      targetHue = (targetHue + speed * 0.8) % 360;
    };
    window.addEventListener("mousemove", onMove);

    // Draw organic blob using canvas path with sinusoidal radii per segment
    // 5 layers: innermost 40px → outermost 200px, opacity 0.20 → 0.019 (×0.55 each step)
    const LAYERS = [
      { r: 40,  hueShift: 0,   alpha: 0.260, deform: 1.00, speed: 1.00 },
      { r: 75,  hueShift: 25,  alpha: 0.150, deform: 0.80, speed: 0.80 },
      { r: 115, hueShift: 50,  alpha: 0.085, deform: 0.60, speed: 0.60 },
      { r: 158, hueShift: 80,  alpha: 0.048, deform: 0.40, speed: 0.40 },
      { r: 200, hueShift: 115, alpha: 0.028, deform: 0.22, speed: 0.22 },
    ];

    const drawBlob = (cx, cy, layer, hueBase, frameLocal, speedLocal) => {
      const { r: baseR, hueShift, alpha, deform } = layer;
      const hue1 = (hueBase + hueShift) % 360;
      const hue2 = (hue1 + 30) % 360;

      const points = [];
      for (let i = 0; i < N; i++) {
        const angle = phases[i];
        const slowWave = Math.sin(frameLocal * 0.007 + phaseOffsets[i]) * 0.22 * deform;
        const fastWave = Math.sin(frameLocal * 0.019 + ampOffsets[i]) * 0.10 * deform;
        const speedBulge = Math.sin(phases[i] + frameLocal * 0.04) * (speedLocal * 0.4 * deform);
        const r = baseR * (1 + slowWave + fastWave) + speedBulge;
        points.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
      }

      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const curr = points[i];
        const next = points[(i + 1) % N];
        const mid = { x: (curr.x + next.x) / 2, y: (curr.y + next.y) / 2 };
        if (i === 0) ctx.moveTo(mid.x, mid.y);
        else ctx.quadraticCurveTo(curr.x, curr.y, mid.x, mid.y);
      }
      const first = points[0];
      const last = points[N - 1];
      ctx.quadraticCurveTo(last.x, last.y, (last.x + first.x) / 2, (last.y + first.y) / 2);
      ctx.closePath();

      // Very wide falloff + heavy canvas blur for a true soft frontier
      ctx.save();
      ctx.filter = `blur(${Math.round(baseR * 0.95)}px)`;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 2.8);
      grad.addColorStop(0,    `hsla(${hue1}, 78%, 64%, ${alpha})`);
      grad.addColorStop(0.15, `hsla(${hue1}, 76%, 62%, ${alpha * 0.88})`);
      grad.addColorStop(0.35, `hsla(${hue1}, 72%, 58%, ${alpha * 0.60})`);
      grad.addColorStop(0.55, `hsla(${hue2}, 68%, 54%, ${alpha * 0.32})`);
      grad.addColorStop(0.75, `hsla(${hue2}, 64%, 50%, ${alpha * 0.12})`);
      grad.addColorStop(0.90, `hsla(${hue2}, 60%, 46%, ${alpha * 0.03})`);
      grad.addColorStop(1,    "transparent");
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    };

    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, w, h);

      smooth.x += (pos.x - smooth.x) * 0.12;
      smooth.y += (pos.y - smooth.y) * 0.12;

      hue += (targetHue - hue) * 0.06;
      speed *= 0.88;

      // Draw outermost first so inner layers sit on top
      for (let i = LAYERS.length - 1; i >= 0; i--) {
        drawBlob(smooth.x, smooth.y, LAYERS[i], hue, frame, speed * LAYERS[i].speed);
      }

      raf.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  // Extra CSS blur on the whole canvas melts the 5 layers into one seamless haze
  // so no individual layer edge is ever visible.
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, filter: "blur(26px)" }} />;
}
