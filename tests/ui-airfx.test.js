import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';
import { loadDom } from './helpers-dom.js';

let startAirFx;
before(async () => {
  loadDom();
  ({ startAirFx } = await import('../public/airfx.js'));
});

const fakeContext = () => {
  const calls = { setTransform: 0, clearRect: 0 };
  return {
    calls,
    setTransform: () => (calls.setTransform += 1),
    clearRect: () => (calls.clearRect += 1),
    createRadialGradient: () => ({ addColorStop() {} }),
    fillRect() {},
    beginPath() {},
    arc() {},
    fill() {},
  };
};

describe('air-quality background animation', () => {
  let frames;
  let cancelled;
  let media;
  let handlers;

  const setup = ({ reducedMotion }) => {
    loadDom();
    frames = 0;
    cancelled = 0;
    handlers = [];
    media = { matches: reducedMotion, addEventListener: (_type, handler) => handlers.push(handler) };
    window.matchMedia = () => media;
    globalThis.requestAnimationFrame = () => (frames += 1);
    globalThis.cancelAnimationFrame = () => (cancelled += 1);
    const context = fakeContext();
    const canvas = document.getElementById('airfx');
    canvas.getContext = () => context;
    return { canvas, context };
  };

  beforeEach(() => setup({ reducedMotion: false }));

  it('does nothing when the canvas has no 2D context', () => {
    const canvas = document.getElementById('airfx');
    canvas.getContext = () => null;
    const fx = startAirFx(canvas);
    assert.equal(typeof fx.setLevel, 'function');
    fx.setLevel('hazardous'); // must not throw
    assert.equal(frames, 0);
  });

  it('starts animating immediately for users without a reduced-motion preference', () => {
    const { canvas } = setup({ reducedMotion: false });
    startAirFx(canvas);
    assert.equal(frames, 1);
  });

  it('stays still for reduced-motion users', () => {
    const { canvas } = setup({ reducedMotion: true });
    const fx = startAirFx(canvas);
    fx.setLevel('unhealthy'); // accepted without starting a loop
    assert.equal(frames, 0);
  });

  it('starts when reduced motion is switched off later, and stops when it is switched on (regression)', () => {
    const { canvas, context } = setup({ reducedMotion: true });
    startAirFx(canvas);
    assert.equal(frames, 0);

    media.matches = false;
    handlers.forEach((handler) => handler());
    assert.equal(frames, 1, 'the loop starts without a reload');

    media.matches = true;
    handlers.forEach((handler) => handler());
    assert.equal(cancelled, 1);
    assert.ok(context.calls.clearRect >= 1, 'the canvas is cleared');
  });

  it('debounces window resizes into a single canvas update', async () => {
    const { canvas, context } = setup({ reducedMotion: true });
    startAirFx(canvas);
    const initial = context.calls.setTransform;
    for (let i = 0; i < 5; i += 1) window.dispatchEvent(new window.Event('resize'));
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(context.calls.setTransform, initial + 1);
  });
});
