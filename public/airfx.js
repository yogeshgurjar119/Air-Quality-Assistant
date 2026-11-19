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
const MAX_PIXEL_RATIO = 1.5;
const RESIZE_DEBOUNCE_MS = 120;
const HAZE_BLOBS = 4;
const PARTICLES_PER_PIXEL = 1 / 22;
const MIN_PARTICLES = 24;
const MAX_PARTICLES = 70;
const PARTICLE_ALPHA = 0.4;
const HAZE_ALPHA = 0.05;
const TWO_PI = Math.PI * 2;

const rand = (min, max) => min + Math.random() * (max - min);

// ── Scene model ─────────────────────────────────────────────────────────────────────────────
const createScene = () => ({
  level: 'good',
  rgb: [...COLOR.good],
  haze: DENSITY.good,
  particles: [],
  blobs: Array.from({ length: HAZE_BLOBS }, (_, i) => ({
    x: rand(0, 1),
    y: rand(0.1, 0.9),
    r: rand(0.25, 0.45),
    speed: 0.004 + i * 0.002,
  })),
});

const spawnParticle = ({ width, height }, fromEdge = false) => ({
  x: fromEdge ? -10 : rand(0, width),
  y: rand(0, height),
  r: rand(1, 3.4),
  speed: rand(12, 34),
  wobble: rand(0, TWO_PI),
  amp: rand(4, 16),
});

const targetParticleCount = (width, level) =>
  Math.round(Math.min(Math.max(width * PARTICLES_PER_PIXEL, MIN_PARTICLES), MAX_PARTICLES) * DENSITY[level]);

/** Eases colour and haze toward the current band, and grows or shrinks the particle count gradually. */
const adaptToLevel = (scene, size, dt) => {
  const ease = Math.min(dt * 2, 1);
  const target = COLOR[scene.level];
  scene.rgb = scene.rgb.map((channel, i) => channel + (target[i] - channel) * ease);
  scene.haze += (DENSITY[scene.level] - scene.haze) * ease;

  const wanted = targetParticleCount(size.width, scene.level);
  if (scene.particles.length < wanted) scene.particles.push(spawnParticle(size, true));
  else if (scene.particles.length > wanted) scene.particles.pop();
};

/** Moves haze and particles for one frame; particles that leave the screen re-enter from the left. */
const advance = (scene, size, dt) => {
  scene.blobs.forEach((blob) => {
    blob.x = (blob.x + blob.speed * dt) % 1.4;
  });
  scene.particles.forEach((particle, i) => {
    particle.x += particle.speed * dt;
    particle.wobble += dt;
    if (particle.x > size.width + 10) scene.particles[i] = spawnParticle(size, true);
  });
};

// ── Drawing ─────────────────────────────────────────────────────────────────────────────────
const rgbaString = (rgb, alpha) => `rgba(${rgb.map(Math.round).join(',')},${alpha})`;

const drawHaze = (context, { blobs, rgb, haze }, { width, height }) => {
  blobs.forEach((blob) => {
    const cx = (blob.x - 0.2) * width;
    const cy = blob.y * height;
    const gradient = context.createRadialGradient(cx, cy, 0, cx, cy, blob.r * Math.max(width, height));
    gradient.addColorStop(0, rgbaString(rgb, (HAZE_ALPHA * haze).toFixed(3)));
    gradient.addColorStop(1, rgbaString(rgb, 0));
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  });
};

const drawParticles = (context, { particles, rgb }) => {
  context.fillStyle = rgbaString(rgb, PARTICLE_ALPHA);
  particles.forEach((particle) => {
    context.beginPath();
    context.arc(particle.x, particle.y + Math.sin(particle.wobble) * particle.amp, particle.r, 0, TWO_PI);
    context.fill();
  });
};

// ── Browser plumbing ────────────────────────────────────────────────────────────────────────
/** Sizes the canvas to the window (capped pixel ratio for speed) and returns the CSS-pixel size. */
const fitCanvasToWindow = (canvas, context) => {
  const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
  const size = { width: window.innerWidth, height: window.innerHeight };
  canvas.width = Math.round(size.width * ratio);
  canvas.height = Math.round(size.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return size;
};

const debounce = (callback, delayMs) => {
  let timer = 0;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(callback, delayMs);
  };
};

/** A requestAnimationFrame loop that reports the (capped) seconds elapsed since the previous frame. */
const createLoop = (onFrame) => {
  let handle = 0;
  let last = 0;
  const tick = (now) => {
    handle = requestAnimationFrame(tick);
    const dt = Math.min(now - last, MAX_FRAME_MS) / 1000;
    last = now;
    onFrame(dt);
  };
  return {
    start() {
      if (handle || document.hidden) return;
      last = performance.now();
      handle = requestAnimationFrame(tick);
    },
    stop() {
      cancelAnimationFrame(handle);
      handle = 0;
    },
  };
};

/** Starts the canvas background animation; returns a function that stops it. */
export const startAirFx = (canvas) => {
  const context = canvas.getContext('2d');
  if (!context) return { setLevel() {} };

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = createScene();
  let size = fitCanvasToWindow(canvas, context);

  const loop = createLoop((dt) => {
    context.clearRect(0, 0, size.width, size.height);
    adaptToLevel(scene, size, dt);
    advance(scene, size, dt);
    drawHaze(context, scene, size);
    drawParticles(context, scene);
  });

  window.addEventListener(
    'resize',
    debounce(() => {
      size = fitCanvasToWindow(canvas, context);
    }, RESIZE_DEBOUNCE_MS),
  );
  document.addEventListener('visibilitychange', () => (document.hidden ? loop.stop() : loop.start()));
  motion.addEventListener('change', () => {
    if (motion.matches) {
      loop.stop();
      context.clearRect(0, 0, size.width, size.height);
    } else {
      loop.start();
    }
  });
  if (!motion.matches) loop.start();

  return {
    /** Re-tints and re-densifies the scene for an AQI band (`good` … `hazardous`). */
    setLevel(next) {
      if (COLOR[next]) scene.level = next;
    },
  };
};
