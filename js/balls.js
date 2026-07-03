// Ball creation, sizing, and color mapping.
const { Bodies, Body } = Matter;

// Radius grows with value but sub-linearly so big balls stay playable.
export function radiusFor(value) {
  const steps = Math.log2(value); // 2 -> 1, 4 -> 2, 8 -> 3 ...
  return 16 + steps * 3.4;
}

// A palette that shifts hue as the number grows. Repeats gracefully past 2048.
export function colorFor(value) {
  const steps = Math.log2(value); // 1,2,3...
  const hue = (200 + steps * 32) % 360;
  const sat = 68;
  const light = Math.max(42, 60 - steps * 1.4);
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

export function textColorFor(value) {
  return '#0b1020';
}

let idCounter = 1;

export function createBall(value, x, y, opts = {}) {
  const r = radiusFor(value);
  const body = Bodies.circle(x, y, r, {
    restitution: 0.28,
    friction: 0.04,
    frictionAir: 0.006,
    density: 0.0016,
    label: 'ball',
    // Slightly rounded collision — Matter circles are exact, good for merging.
  });
  body.plugin = body.plugin || {};
  body.gameId = idCounter++;
  body.value = value;
  body.radius = r;
  body.merging = false;      // guards against double-merge in one tick
  body.popT = 0;             // pop animation timer (spawn)
  body.spawnT = opts.spawnT || 0;
  body.aboveDangerSince = null; // timestamp used for game-over detection
  return body;
}

// Grow a body's physical radius to match a new value (used on merge target).
export function setBallValue(body, value) {
  const newR = radiusFor(value);
  const scale = newR / body.radius;
  Body.scale(body, scale, scale);
  body.value = value;
  body.radius = newR;
}
