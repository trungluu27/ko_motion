export type Vec3 = { x: number; y: number; z: number };

export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

export const dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export const dist2d = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y);

export const mid = (a: Vec3, b: Vec3): Vec3 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });

/** Angle at vertex b, in degrees (0..180). */
export function angleDeg(a: Vec3, b: Vec3, c: Vec3): number {
  const u = sub(a, b);
  const v = sub(c, b);
  const nu = Math.hypot(u.x, u.y, u.z);
  const nv = Math.hypot(v.x, v.y, v.z);
  if (nu === 0 || nv === 0) return 0;
  const cos = (u.x * v.x + u.y * v.y + u.z * v.z) / (nu * nv);
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
}

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

export function median(xs: number[]): number {
  return percentile(xs, 50);
}

/** Linear-interpolated percentile, p in [0,100]. Returns NaN for an empty list. */
export function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = ((s.length - 1) * p) / 100;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
