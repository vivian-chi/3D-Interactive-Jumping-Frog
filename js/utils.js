// ─── Easing ───────────────────────────────────────────────────────────────────

export function easeOutSine(t)    { return Math.sin(t * Math.PI / 2); }
export function easeInSine(t)     { return 1 - Math.cos(t * Math.PI / 2); }
export function easeInOutSine(t)  { return -(Math.cos(Math.PI * t) - 1) / 2; }

export function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

export function lerp(a, b, t)        { return a + (b - a) * t; }
export function clamp(v, min, max)   { return Math.max(min, Math.min(max, v)); }

/** Shortest-path angle interpolation (handles wraparound) */
export function lerpAngle(a, b, t) {
  let diff = ((b - a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  return a + diff * t;
}
