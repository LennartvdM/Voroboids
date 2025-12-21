// Math utilities for Voroboids

import type { Vec2, BezierPath } from './types';

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function mul(v: Vec2, scalar: number): Vec2 {
  return { x: v.x * scalar, y: v.y * scalar };
}

export function div(v: Vec2, scalar: number): Vec2 {
  return scalar !== 0 ? { x: v.x / scalar, y: v.y / scalar } : { x: 0, y: 0 };
}

export function magnitude(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function normalize(v: Vec2): Vec2 {
  const mag = magnitude(v);
  return mag > 0 ? div(v, mag) : { x: 0, y: 0 };
}

export function limit(v: Vec2, max: number): Vec2 {
  const mag = magnitude(v);
  if (mag > max) {
    return mul(normalize(v), max);
  }
  return v;
}

export function distance(a: Vec2, b: Vec2): number {
  return magnitude(sub(a, b));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
  };
}

// Cubic bezier evaluation
export function bezierPoint(path: BezierPath, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;

  return {
    x: mt3 * path.start.x + 3 * mt2 * t * path.control1.x + 3 * mt * t2 * path.control2.x + t3 * path.end.x,
    y: mt3 * path.start.y + 3 * mt2 * t * path.control1.y + 3 * mt * t2 * path.control2.y + t3 * path.end.y,
  };
}

// Bezier tangent (derivative)
export function bezierTangent(path: BezierPath, t: number): Vec2 {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return {
    x: 3 * mt2 * (path.control1.x - path.start.x) +
       6 * mt * t * (path.control2.x - path.control1.x) +
       3 * t2 * (path.end.x - path.control2.x),
    y: 3 * mt2 * (path.control1.y - path.start.y) +
       6 * mt * t * (path.control2.y - path.control1.y) +
       3 * t2 * (path.end.y - path.control2.y),
  };
}

// Box-Muller transform for normal distribution
export function gaussianRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

// Easing functions
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutElastic(t: number): number {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// Smooth step for blob morphing
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Perlin-like noise for blob wobble (simplified)
export function noise2D(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

// Random point in circle
export function randomInCircle(center: Vec2, radius: number): Vec2 {
  const angle = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * radius;
  return {
    x: center.x + Math.cos(angle) * r,
    y: center.y + Math.sin(angle) * r,
  };
}

// Clamp value
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
