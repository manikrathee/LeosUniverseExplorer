export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function mulberry32(seed) {
  return function rng() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randn(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function colorForStar(rng) {
  const roll = rng();
  if (roll < 0.58) return "255,243,232";
  if (roll < 0.78) return "194,223,255";
  if (roll < 0.92) return "255,214,158";
  return "165,233,255";
}

export function hexToRgb(hex) {
  const value = hex.replace("#", "");
  const full = value.length === 3
    ? value.split("").map((part) => part + part).join("")
    : value;
  const num = Number.parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r},${g},${b}`;
}

export function rgba(hex, alpha) {
  return `rgba(${hexToRgb(hex)}, ${alpha})`;
}
