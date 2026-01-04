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

// =====================
// Constrained polygon utilities
// These transform a logical Voronoi polygon into a physical cell
// that respects geometric constraints (max extent, min angle, convexity)
// =====================

/**
 * Compute the angle at a vertex (in radians)
 * Returns the interior angle at vertex `curr` formed by edges from prev and to next
 */
export function vertexAngle(prev: Vec2, curr: Vec2, next: Vec2): number {
  const v1 = normalize(sub(prev, curr));
  const v2 = normalize(sub(next, curr));

  // Clamp dot product to avoid NaN from floating point errors
  const d = clamp(dot(v1, v2), -1, 1);
  return Math.acos(d);
}

/**
 * Compute the minimum angle that can accommodate an inscribed circle of given radius
 * at a corner. The formula: if a circle of radius r is inscribed in a corner,
 * the half-angle α satisfies: r = d * tan(α/2) where d is distance from corner to tangent point
 * For our constraint: we specify the radius and the offset distance.
 */
export function minAngleForInscribedBall(radius: number, offset: number): number {
  // The inscribed ball constraint: a ball of `radius` must fit in the corner
  // at a distance of `offset` from the vertex
  // half-angle = atan(radius / offset)
  // full interior angle = π - 2 * half-angle
  const halfAngle = Math.atan2(radius, offset);
  return Math.PI - 2 * halfAngle;
}

/**
 * Check if a polygon is convex (all vertices turn the same direction)
 */
export function isConvex(polygon: Vec2[]): boolean {
  if (polygon.length < 3) return false;

  let sign = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];
    const p3 = polygon[(i + 2) % n];

    // Cross product of edges
    const cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);

    if (cross !== 0) {
      if (sign === 0) {
        sign = cross > 0 ? 1 : -1;
      } else if ((cross > 0 ? 1 : -1) !== sign) {
        return false; // Direction changed - not convex
      }
    }
  }

  return true;
}

/**
 * Compute the convex hull of a set of points using Graham scan
 */
export function convexHull(points: Vec2[]): Vec2[] {
  if (points.length < 3) return [...points];

  // Find the bottom-most point (or left-most in case of tie)
  let minIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < points[minIdx].y ||
        (points[i].y === points[minIdx].y && points[i].x < points[minIdx].x)) {
      minIdx = i;
    }
  }

  const pivot = points[minIdx];

  // Sort points by polar angle with respect to pivot
  const sorted = points
    .filter((_, i) => i !== minIdx)
    .map(p => ({
      point: p,
      angle: Math.atan2(p.y - pivot.y, p.x - pivot.x),
      dist: distance(p, pivot)
    }))
    .sort((a, b) => {
      if (Math.abs(a.angle - b.angle) < 1e-10) {
        return a.dist - b.dist; // Same angle, closer first
      }
      return a.angle - b.angle;
    })
    .map(p => p.point);

  // Graham scan
  const hull: Vec2[] = [pivot];

  for (const p of sorted) {
    // Remove points that make clockwise turn
    while (hull.length > 1) {
      const top = hull[hull.length - 1];
      const second = hull[hull.length - 2];
      const cross = (top.x - second.x) * (p.y - second.y) - (top.y - second.y) * (p.x - second.x);

      if (cross <= 0) {
        hull.pop();
      } else {
        break;
      }
    }
    hull.push(p);
  }

  return hull;
}

/**
 * Clamp polygon vertices to a maximum distance from center
 * Vertices beyond maxExtent are pulled in along the ray from center
 */
export function clampPolygonExtent(polygon: Vec2[], center: Vec2, maxExtent: number): Vec2[] {
  return polygon.map(vertex => {
    const toVertex = sub(vertex, center);
    const dist = magnitude(toVertex);

    if (dist > maxExtent) {
      // Pull vertex in to maxExtent
      return add(center, mul(normalize(toVertex), maxExtent));
    }
    return vertex;
  });
}

/**
 * Enforce minimum corner angles by "cutting" corners that are too sharp
 * Uses the inscribed ball constraint: each corner must fit a ball of given radius
 *
 * @param polygon - The polygon to constrain
 * @param cornerRadius - Radius of the inscribed ball (same as visual corner rounding)
 * @param ballOffset - How far into the corner the ball sits (affects min angle)
 * @returns Polygon with sharp corners cut or pushed out
 */
export function enforceMinimumAngles(
  polygon: Vec2[],
  cornerRadius: number,
  ballOffset: number = cornerRadius * 1.5
): Vec2[] {
  if (polygon.length < 3) return polygon;

  const minAngle = minAngleForInscribedBall(cornerRadius, ballOffset);
  const result: Vec2[] = [];
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n];
    const curr = polygon[i];
    const next = polygon[(i + 1) % n];

    const angle = vertexAngle(prev, curr, next);

    if (angle >= minAngle) {
      // Corner is wide enough, keep it
      result.push(curr);
    } else {
      // Corner is too sharp - cut it by adding two points
      // The cut creates a new edge where the inscribed ball would be tangent

      const toPrev = normalize(sub(prev, curr));
      const toNext = normalize(sub(next, curr));

      // Calculate how far along each edge to place the cut points
      // This is where the inscribed ball would be tangent
      const cutDist = ballOffset;

      // Limit cut distance to half the edge length
      const distToPrev = magnitude(sub(prev, curr));
      const distToNext = magnitude(sub(next, curr));
      const maxCut = Math.min(distToPrev, distToNext) * 0.4;
      const actualCut = Math.min(cutDist, maxCut);

      const cutPoint1 = add(curr, mul(toPrev, actualCut));
      const cutPoint2 = add(curr, mul(toNext, actualCut));

      result.push(cutPoint1, cutPoint2);
    }
  }

  return result;
}

/**
 * Full constraint pipeline: apply all constraints to transform a logical Voronoi polygon
 * into a physical cell polygon
 *
 * @param polygon - The raw Voronoi polygon
 * @param center - Cell center point
 * @param maxExtent - Maximum distance from center (prevents stretching)
 * @param cornerRadius - Minimum inscribed ball radius (prevents sharp corners)
 * @returns Constrained physical polygon
 */
export function constrainPolygon(
  polygon: Vec2[],
  center: Vec2,
  maxExtent: number,
  cornerRadius: number
): Vec2[] {
  if (polygon.length < 3) return polygon;

  // Step 1: Clamp to maximum extent (prevents pizza stretching)
  let constrained = clampPolygonExtent(polygon, center, maxExtent);

  // Step 2: Ensure convexity (extent clamping can create concave shapes)
  if (!isConvex(constrained)) {
    constrained = convexHull(constrained);
  }

  // Step 3: Enforce minimum angles (inscribed ball constraint)
  constrained = enforceMinimumAngles(constrained, cornerRadius);

  // Step 4: Final convexity check (angle enforcement can theoretically break it)
  if (!isConvex(constrained)) {
    constrained = convexHull(constrained);
  }

  return constrained;
}
