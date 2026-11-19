/**
 * Decorative background: wind-blown particles and soft haze that reflect the air quality.
 * Clean air = a few cool teal specks; polluted air = denser, warmer, hazier. Purely visual:
 * it is aria-hidden, paused when the tab is hidden, and disabled for reduced-motion users.
 */

const COLOR = {
  good: [45, 212, 191],
  moderate: [250, 204, 21],
  sensitive: [251, 146, 60],
  unhealthy: [248, 113, 113],
  very_unhealthy: [192, 132, 252],
  hazardous: [239, 68, 68],
};
/** Relative particle density per AQI band. */
const DENSITY = { good: 0.35, moderate: 0.55, sensitive: 0.8, unhealthy: 1, very_unhealthy: 1.25, hazardous: 1.5 };
const MAX_FRAME_MS = 50;
const HAZE_BLOBS = 4;

const rand = (min, max) => min + Math.random() * (max - min);

export const startAirFx = (canvas) => {
  const context = canvas.getContext('2d');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!context) return { setLevel() {} };

  let width = 0;
  let height = 0;
  let level = 'good';
  let rgb = [...COLOR.good];
  let haze = DENSITY.good;
  let raf = 0;
  let last = 0;
  const particles = [];
  const blobs = Array.from({ length: HAZE_BLOBS }, (_, i) => ({
    x: rand(0, 1),
    y: rand(0.1, 0.9),
    r: rand(0.25, 0.45),
    speed: 0.004 + i * 0.002,
  }));

  const targetCount = () => Math.round(Math.min(Math.max(width / 22, 24), 70) * DENSITY[level]);
  const spawn = (fromEdge = false) => ({
    x: fromEdge ? -10 : rand(0, width),
    y: rand(0, height),
    r: rand(1, 3.4),
    speed: rand(12, 34),
    wobble: rand(0, Math.PI * 2),
    amp: rand(4, 16),
  });

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(now - last, MAX_FRAME_MS) / 1000;
    last = now;
    context.clearRect(0, 0, width, height);

    // Ease colour and haze toward the current band; grow or shrink the particle count gradually.
    const target = COLOR[level];
    rgb = rgb.map((channel, i) => channel + (target[i] - channel) * Math.min(dt * 2, 1));
    haze += (DENSITY[level] - haze) * Math.min(dt * 2, 1);
    const wanted = targetCount();
    if (particles.length < wanted) particles.push(spawn(true));
    else if (particles.length > wanted) particles.pop();

    const [r, g, b] = rgb.map(Math.round);
    blobs.forEach((blob) => {
      blob.x = (blob.x + blob.speed * dt) % 1.4;
      const cx = (blob.x - 0.2) * width;
      const cy = blob.y * height;
      const radius = blob.r * Math.max(width, height);
      const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, `rgba(${r},${g},${b},${(0.05 * haze).toFixed(3)})`);
      gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    });

    context.fillStyle = `rgba(${r},${g},${b},0.4)`;
    particles.forEach((p, i) => {
      p.x += p.speed * dt;
      p.wobble += dt;
      if (p.x > width + 10) particles[i] = spawn(true);
      context.beginPath();
      context.arc(p.x, p.y + Math.sin(p.wobble) * p.amp, p.r, 0, Math.PI * 2);
      context.fill();
    });
  };

  const start = () => {
    if (raf || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  resize();
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  motion.addEventListener('change', () => {
    if (motion.matches) {
      stop();
      context.clearRect(0, 0, width, height);
    } else {
      start();
    }
  });
  if (!motion.matches) start();

  return {
    /** Re-tints and re-densifies the scene for an AQI band (`good` … `hazardous`). */
    setLevel(next) {
      if (COLOR[next]) level = next;
    },
  };
};
