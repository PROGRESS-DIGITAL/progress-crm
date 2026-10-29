// Конфетти из точки на экране: разлетаются во все стороны, падают и гаснут. Без библиотек:
// временный холст поверх страницы, который убирается сам. При «уменьшить движение» не показываются
const COLORS = ["#2563eb", "#60a5fa", "#93c5fd", "#22c55e", "#facc15", "#f472b6", "#f97316"];

export function burstConfetti(x: number, y: number, count = 140) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "60" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.remove();
  ctx.scale(dpr, dpr);

  const pieces = Array.from({ length: count }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 5,
      w: 6 + Math.random() * 6,
      h: 3 + Math.random() * 4,
      spin: Math.random() * Math.PI,
      vspin: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  });

  const LIFE = 1800;
  const start = performance.now();
  let last = start;
  const frame = (now: number) => {
    const t = now - start;
    const k = Math.min(2, (now - last) / 16.7);
    last = now;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - LIFE * 0.6) / (LIFE * 0.4));
    for (const p of pieces) {
      p.vx *= 0.985 ** k;
      p.vy = p.vy * 0.985 ** k + 0.32 * k;
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.spin += p.vspin * k;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      // Полоска «переворачивается» в полёте: ширина меняется по синусу
      ctx.scale(1, Math.cos(p.spin * 2));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t < LIFE) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
