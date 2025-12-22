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

// Distance from point to line segment, returns closest point and distance
export function pointToSegment(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; distance: number } {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const lenSq = ab.x * ab.x + ab.y * ab.y;

  if (lenSq === 0) {
    // Segment is a point
    return { point: a, distance: magnitude(ap) };
  }

  // Project p onto line ab, clamping to segment
  let t = (ap.x * ab.x + ap.y * ab.y) / lenSq;
  t = clamp(t, 0, 1);

  const closest = vec2(a.x + t * ab.x, a.y + t * ab.y);
  return { point: closest, distance: magnitude(sub(p, closest)) };
}

// Get normal vector pointing away from a line segment toward a point
export function segmentNormalToward(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const { point } = pointToSegment(p, a, b);
  const away = sub(p, point);
  const mag = magnitude(away);
  return mag > 0 ? div(away, mag) : vec2(0, 0);
}

// =====================
// Polygon utilities
// =====================

// Compute the signed area of a polygon (positive = CCW, negative = CW)
export function polygonArea(polygon: Vec2[]): number {
  if (polygon.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i].x * polygon[j].y;
    area -= polygon[j].x * polygon[i].y;
  }
  return area / 2;
}

// Compute the centroid of a polygon
export function polygonCentroid(polygon: Vec2[]): Vec2 {
  if (polygon.length === 0) return vec2(0, 0);
  if (polygon.length === 1) return polygon[0];
  if (polygon.length === 2) return lerpVec2(polygon[0], polygon[1], 0.5);

  const area = polygonArea(polygon);
  if (Math.abs(area) < 0.0001) {
    // Degenerate polygon, return average of points
    let cx = 0, cy = 0;
    for (const p of polygon) {
      cx += p.x;
      cy += p.y;
    }
    return vec2(cx / polygon.length, cy / polygon.length);
  }

  let cx = 0, cy = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const cross = polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
    cx += (polygon[i].x + polygon[j].x) * cross;
    cy += (polygon[i].y + polygon[j].y) * cross;
  }

  const factor = 1 / (6 * area);
  return vec2(cx * factor, cy * factor);
}

// Dot product
export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

// Clip polygon against a half-plane defined by a point and normal
// Keeps the half of the polygon on the side the normal points away from
export function clipPolygonByPlane(polygon: Vec2[], planePoint: Vec2, planeNormal: Vec2): Vec2[] {
  if (polygon.length < 3) return polygon;

  const result: Vec2[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];

    // Distance from plane (positive = on normal side, negative = opposite)
    const currentDist = dot(sub(current, planePoint), planeNormal);
    const nextDist = dot(sub(next, planePoint), planeNormal);

    // Current point is inside (on the opposite side of normal)
    if (currentDist <= 0) {
      result.push(current);
    }

    // Edge crosses the plane - add intersection point
    if ((currentDist > 0 && nextDist < 0) || (currentDist < 0 && nextDist > 0)) {
      // Compute intersection
      const t = currentDist / (currentDist - nextDist);
      const intersection = lerpVec2(current, next, t);
      result.push(intersection);
    }
  }

  return result;
}

// Create a rectangular polygon from bounds
export function rectToPolygon(x: number, y: number, width: number, height: number): Vec2[] {
  return [
    vec2(x, y),
    vec2(x + width, y),
    vec2(x + width, y + height),
    vec2(x, y + height),
  ];
}

// Create a circular polygon (approximated with segments)
export function circleToPolygon(center: Vec2, radius: number, segments: number = 16): Vec2[] {
  const points: Vec2[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(vec2(
      center.x + Math.cos(angle) * radius,
      center.y + Math.sin(angle) * radius
    ));
  }
  return points;
}

// Inset polygon by a fixed distance (shrink toward center)
export function insetPolygon(polygon: Vec2[], amount: number): Vec2[] {
  if (polygon.length < 3 || amount === 0) return polygon;

  const result: Vec2[] = [];
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n];
    const curr = polygon[i];
    const next = polygon[(i + 1) % n];

    // Edge vectors
    const edge1 = normalize(sub(curr, prev));
    const edge2 = normalize(sub(next, curr));

    // Inward normals (perpendicular, pointing inward assuming CCW winding)
    const normal1 = vec2(-edge1.y, edge1.x);
    const normal2 = vec2(-edge2.y, edge2.x);

    // Average normal (bisector direction)
    const avgNormal = normalize(add(normal1, normal2));

    // Miter length to maintain distance from both edges
    const dotProduct = dot(avgNormal, normal1);
    const miterLength = dotProduct !== 0 ? amount / dotProduct : amount;

    // Clamp miter length to avoid spikes
    const clampedMiter = Math.min(miterLength, amount * 3);

    result.push(add(curr, mul(avgNormal, clampedMiter)));
  }

  return result;
}

// Check if a point is inside a polygon (ray casting)
export function pointInPolygon(point: Vec2, polygon: Vec2[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i];
    const pj = polygon[j];

    if (((pi.y > point.y) !== (pj.y > point.y)) &&
        (point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x)) {
      inside = !inside;
    }
  }

  return inside;
}
