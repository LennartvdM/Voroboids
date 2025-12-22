// Voroboid - an autonomous organism with simple, consistent rules
// No modes, no phases - just physics that always applies

import type { Vec2, Wall, VoroboidConfig, FlockConfig, MagnetConfig, VoroboidContent } from './types';
import {
  vec2, add, sub, mul, normalize, magnitude, limit, pointToSegment, lerpVec2,
  clipPolygonByPlane, polygonArea as computePolygonArea, rectToPolygon
} from './math';

export class Voroboid {
  id: number;
  color: string;
  weight: number;

  // Physics - in world coordinates
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;

  // For rendering blob shape
  blobRadius: number = 25;
  wobblePhase: number = Math.random() * Math.PI * 2;
  wobbleSpeed: number = 3 + Math.random() * 2;

  // Settling state
  settled: boolean = false;
  settleTime: number = 0;
  private readonly settleThreshold: number = 0.5;  // Velocity magnitude threshold
  private readonly settleDelay: number = 200;      // ms before considered settled

  // Polygon tessellation
  polygon: Vec2[] = [];              // Computed boundary vertices (smoothed)
  targetArea: number = 2500;         // Desired area (based on blobRadius^2 * π)
  currentArea: number = 0;           // Actual area of current polygon
  pressure: number = 1;              // Internal pressure = targetArea / currentArea
  private readonly smoothingFactor = 0.15;  // How quickly polygon interpolates (0-1)

  // Content
  content?: VoroboidContent;
  contentImage?: HTMLImageElement;   // Cached image element
  imageLoaded: boolean = false;

  constructor(config: VoroboidConfig) {
    this.id = config.id;
    this.color = config.color;
    this.weight = config.weight;
    this.position = vec2(0, 0);
    this.velocity = vec2(0, 0);
    this.acceleration = vec2(0, 0);
    // Target area based on blob radius (circle area = π * r²)
    // Weight affects target area - heavier voroboids want more space
    this.targetArea = Math.PI * this.blobRadius * this.blobRadius * this.weight;

    // Set content and preload images
    if (config.content) {
      this.content = config.content;
      if (config.content.type === 'image') {
        this.preloadImage(config.content.src);
      }
    }
  }

  // Preload image for content rendering
  private preloadImage(src: string): void {
    const img = new Image();
    img.onload = () => {
      this.contentImage = img;
      this.imageLoaded = true;
    };
    img.onerror = () => {
      console.warn(`Failed to load image for voroboid ${this.id}: ${src}`);
    };
    img.src = src;
  }

  // Main update - apply all forces based on local rules
  // The voroboid doesn't know about containers - just walls, neighbors, and gravity
  update(deltaTime: number, neighbors: Voroboid[], walls: Wall[], config: FlockConfig, magnet?: MagnetConfig): void {
    this.acceleration = vec2(0, 0);

    // Apply gravity toward container magnet (primary settling force)
    if (magnet) {
      const gravityForce = this.computeGravity(magnet, config);
      this.applyForce(gravityForce);
    }

    // Boid behaviors - reduced when settling
    const separation = this.computeSeparation(neighbors, config);
    const cohesion = this.computeCohesion(neighbors, config);
    const alignment = this.computeAlignment(neighbors, config);

    this.applyForce(mul(separation, config.separationWeight));
    this.applyForce(mul(cohesion, config.cohesionWeight * 0.3)); // Reduce cohesion for settling
    this.applyForce(mul(alignment, config.alignmentWeight * 0.2)); // Reduce alignment for settling

    // Wall repulsion - always active for all walls
    const wallForce = this.computeWallRepulsion(walls, config);
    this.applyForce(mul(wallForce, config.wallRepulsionStrength));

    // Strong damping - water balloons are heavy
    this.applyForce(mul(this.velocity, -config.damping));

    // Integrate physics
    this.velocity = add(this.velocity, this.acceleration);
    this.velocity = limit(this.velocity, config.maxSpeed);
    this.position = add(this.position, mul(this.velocity, deltaTime * 0.06));

    // Position correction for overlaps (hard constraint)
    this.resolveCollisions(neighbors);

    // Constrain to walls (hard position constraint)
    this.constrainToWalls(walls, config);

    // Check if settled
    this.checkSettled(deltaTime);

    // Update wobble
    this.wobblePhase += deltaTime * 0.001 * this.wobbleSpeed;
  }

  // Hard position correction for overlapping voroboids
  private resolveCollisions(neighbors: Voroboid[]): void {
    const minDist = this.blobRadius * 1.8; // Slightly less than 2x for slight overlap visual

    for (const other of neighbors) {
      if (other.id === this.id) continue;

      const diff = sub(this.position, other.position);
      const dist = magnitude(diff);

      if (dist > 0 && dist < minDist) {
        // Overlap! Push apart
        const overlap = minDist - dist;
        const correction = mul(normalize(diff), overlap * 0.5); // Each moves half

        // Apply position correction
        this.position = add(this.position, correction);

        // Also dampen relative velocity (inelastic collision)
        const relVel = sub(this.velocity, other.velocity);
        const normalDir = normalize(diff);
        const relVelNormal = mul(normalDir, relVel.x * normalDir.x + relVel.y * normalDir.y);
        this.velocity = sub(this.velocity, mul(relVelNormal, 0.3));
      }
    }
  }

  // Hard constraint to stay inside walls
  private constrainToWalls(walls: Wall[], _config: FlockConfig): void {
    const margin = this.blobRadius * 0.8;

    for (const wall of walls) {
      const { point, distance } = pointToSegment(this.position, wall.start, wall.end);

      if (distance < margin) {
        // Push away from wall
        const away = normalize(sub(this.position, point));
        const penetration = margin - distance;
        this.position = add(this.position, mul(away, penetration));

        // Dampen velocity toward wall
        const velTowardWall = this.velocity.x * (-away.x) + this.velocity.y * (-away.y);
        if (velTowardWall > 0) {
          this.velocity = sub(this.velocity, mul(away, -velTowardWall * 0.5));
        }
      }
    }
  }

  // Check if voroboid has settled (stopped moving significantly)
  private checkSettled(deltaTime: number): void {
    if (magnitude(this.velocity) < this.settleThreshold) {
      this.settleTime += deltaTime;
      if (this.settleTime > this.settleDelay) {
        this.settled = true;
      }
    } else {
      this.settleTime = 0;
      this.settled = false;
    }
  }

  // Compute gravity force toward container magnet
  private computeGravity(magnet: MagnetConfig, config: FlockConfig): Vec2 {
    // Use directional gravity if specified, otherwise pull toward magnet position
    if (magnet.direction) {
      // Constant directional gravity (like real gravity)
      return mul(magnet.direction, config.gravityStrength);
    } else {
      // Point attractor - pull toward magnet position
      const toMagnet = sub(magnet.position, this.position);
      const dist = magnitude(toMagnet);
      if (dist > 0) {
        // Constant strength in the direction of the magnet
        return mul(normalize(toMagnet), config.gravityStrength);
      }
    }
    return vec2(0, 0);
  }

  private applyForce(force: Vec2): void {
    this.acceleration = add(this.acceleration, force);
  }

  // Separation: steer away from nearby neighbors
  private computeSeparation(neighbors: Voroboid[], config: FlockConfig): Vec2 {
    const desiredSeparation = this.blobRadius * 2.5;
    let steer = vec2(0, 0);
    let count = 0;

    for (const other of neighbors) {
      if (other.id === this.id) continue;
      const d = magnitude(sub(this.position, other.position));
      if (d > 0 && d < desiredSeparation) {
        const diff = normalize(sub(this.position, other.position));
        const weighted = mul(diff, 1 / (d * d)); // Inverse square falloff
        steer = add(steer, weighted);
        count++;
      }
    }

    if (count > 0) {
      steer = mul(steer, 1 / count);
      if (magnitude(steer) > 0) {
        steer = mul(normalize(steer), config.maxSpeed);
        steer = sub(steer, this.velocity);
        steer = limit(steer, config.maxForce * 2);
      }
    }

    return steer;
  }

  // Cohesion: steer toward center of nearby neighbors
  private computeCohesion(neighbors: Voroboid[], config: FlockConfig): Vec2 {
    const neighborDist = this.blobRadius * 6;
    let sum = vec2(0, 0);
    let count = 0;

    for (const other of neighbors) {
      if (other.id === this.id) continue;
      const d = magnitude(sub(this.position, other.position));
      if (d > 0 && d < neighborDist) {
        sum = add(sum, other.position);
        count++;
      }
    }

    if (count > 0) {
      const center = mul(sum, 1 / count);
      const desired = sub(center, this.position);
      if (magnitude(desired) > 0) {
        const scaled = mul(normalize(desired), config.maxSpeed * 0.5);
        let steer = sub(scaled, this.velocity);
        steer = limit(steer, config.maxForce);
        return steer;
      }
    }

    return vec2(0, 0);
  }

  // Alignment: steer to match velocity of nearby neighbors
  private computeAlignment(neighbors: Voroboid[], config: FlockConfig): Vec2 {
    const neighborDist = this.blobRadius * 5;
    let sum = vec2(0, 0);
    let count = 0;

    for (const other of neighbors) {
      if (other.id === this.id) continue;
      const d = magnitude(sub(this.position, other.position));
      if (d > 0 && d < neighborDist) {
        sum = add(sum, other.velocity);
        count++;
      }
    }

    if (count > 0) {
      const avgVel = mul(sum, 1 / count);
      if (magnitude(avgVel) > 0) {
        const desired = mul(normalize(avgVel), config.maxSpeed);
        let steer = sub(desired, this.velocity);
        steer = limit(steer, config.maxForce);
        return steer;
      }
    }

    return vec2(0, 0);
  }

  // Wall repulsion: push away from all walls
  // Openings are simply... not walls. No wall = no repulsion = can pass through.
  private computeWallRepulsion(walls: Wall[], config: FlockConfig): Vec2 {
    let force = vec2(0, 0);

    for (const wall of walls) {
      const { point, distance } = pointToSegment(this.position, wall.start, wall.end);

      if (distance < config.wallRepulsionRange && distance > 0) {
        // Direction away from wall
        const away = normalize(sub(this.position, point));
        // Strength increases as we get closer (inverse relationship)
        const strength = (config.wallRepulsionRange - distance) / config.wallRepulsionRange;
        force = add(force, mul(away, strength * strength));
      }
    }

    return force;
  }

  // Get current shape for rendering - wobbly blob (legacy, used as fallback)
  getCurrentShape(): Vec2[] {
    const points: Vec2[] = [];
    const segments = 16;

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;

      // Procedural wobble
      const wobbleAmount = 0.15;
      const wobble = Math.sin(angle * 3 + this.wobblePhase) * wobbleAmount +
                     Math.sin(angle * 5 + this.wobblePhase * 1.3) * wobbleAmount * 0.5;

      const radius = this.blobRadius * (1 + wobble);

      points.push({
        x: this.position.x + Math.cos(angle) * radius,
        y: this.position.y + Math.sin(angle) * radius,
      });
    }

    return points;
  }

  // Compute Voronoi-like polygon by clipping container bounds against neighbor bisectors
  computePolygon(neighbors: Voroboid[], containerBounds: { x: number; y: number; width: number; height: number }): void {
    // Start with container bounds as the initial polygon
    let polygon = rectToPolygon(
      containerBounds.x,
      containerBounds.y,
      containerBounds.width,
      containerBounds.height
    );

    // Clip against each neighbor's bisector
    for (const neighbor of neighbors) {
      if (neighbor.id === this.id) continue;

      // Only consider neighbors within influence range
      const dist = magnitude(sub(this.position, neighbor.position));
      if (dist > this.blobRadius * 6) continue;

      // Compute bisector position based on pressure ratio
      // Higher pressure pushes the bisector toward the neighbor
      const myPressure = Math.max(0.1, this.pressure);
      const theirPressure = Math.max(0.1, neighbor.pressure);
      const pressureRatio = myPressure / (myPressure + theirPressure);

      // Bisector point: lerp from this position to neighbor position
      // pressureRatio > 0.5 means we have more pressure, bisector shifts toward neighbor
      const bisectorPoint = lerpVec2(this.position, neighbor.position, pressureRatio);

      // Bisector normal points from this toward neighbor
      const toNeighbor = sub(neighbor.position, this.position);
      const bisectorNormal = normalize(toNeighbor);

      // Clip polygon - keep the half on our side
      polygon = clipPolygonByPlane(polygon, bisectorPoint, bisectorNormal);

      // Early exit if polygon becomes degenerate
      if (polygon.length < 3) {
        polygon = this.getFallbackPolygon();
        break;
      }
    }

    // Smooth interpolation for fluid animation
    this.polygon = this.smoothPolygon(polygon);

    // Update current area and pressure
    this.currentArea = Math.abs(computePolygonArea(this.polygon));
    if (this.currentArea > 0) {
      this.pressure = this.targetArea / this.currentArea;
    } else {
      this.pressure = 1;
    }
  }

  // Smooth polygon vertices over time for fluid animation
  private smoothPolygon(target: Vec2[]): Vec2[] {
    // If no previous polygon, use target directly
    if (this.polygon.length === 0) {
      return target.map(p => ({ ...p }));
    }

    // If vertex count changed, resample to match and then interpolate
    // This prevents jarring snaps during container transitions
    if (this.polygon.length !== target.length) {
      const resampled = this.resamplePolygon(this.polygon, target.length);
      const smoothed: Vec2[] = [];
      // Use faster interpolation during transitions
      const transitionFactor = this.smoothingFactor * 2;
      for (let i = 0; i < target.length; i++) {
        smoothed.push(lerpVec2(resampled[i], target[i], transitionFactor));
      }
      return smoothed;
    }

    // Interpolate each vertex toward target
    const smoothed: Vec2[] = [];
    for (let i = 0; i < target.length; i++) {
      smoothed.push(lerpVec2(this.polygon[i], target[i], this.smoothingFactor));
    }

    return smoothed;
  }

  // Resample a polygon to have a different number of vertices
  // Uses linear interpolation along the polygon perimeter
  private resamplePolygon(polygon: Vec2[], targetCount: number): Vec2[] {
    if (polygon.length === 0 || targetCount < 3) {
      return polygon;
    }

    // Calculate total perimeter length and segment lengths
    const segments: { start: Vec2; length: number; cumulative: number }[] = [];
    let totalLength = 0;

    for (let i = 0; i < polygon.length; i++) {
      const start = polygon[i];
      const end = polygon[(i + 1) % polygon.length];
      const length = magnitude(sub(end, start));
      segments.push({ start, length, cumulative: totalLength });
      totalLength += length;
    }

    if (totalLength === 0) {
      // Degenerate polygon - all points at same location
      return Array(targetCount).fill(null).map(() => ({ ...polygon[0] }));
    }

    // Sample points at equal intervals along the perimeter
    const result: Vec2[] = [];
    const step = totalLength / targetCount;

    for (let i = 0; i < targetCount; i++) {
      const targetDist = i * step;

      // Find which segment this distance falls into
      let segIdx = 0;
      for (let j = segments.length - 1; j >= 0; j--) {
        if (segments[j].cumulative <= targetDist) {
          segIdx = j;
          break;
        }
      }

      const seg = segments[segIdx];
      const segStart = seg.start;
      const segEnd = polygon[(segIdx + 1) % polygon.length];

      // Interpolate within segment
      const distIntoSeg = targetDist - seg.cumulative;
      const t = seg.length > 0 ? distIntoSeg / seg.length : 0;

      result.push(lerpVec2(segStart, segEnd, Math.min(1, Math.max(0, t))));
    }

    return result;
  }

  // Fallback polygon when computation fails
  private getFallbackPolygon(): Vec2[] {
    const r = this.blobRadius;
    const segments = 8;
    const points: Vec2[] = [];

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push({
        x: this.position.x + Math.cos(angle) * r,
        y: this.position.y + Math.sin(angle) * r,
      });
    }

    return points;
  }

  // Update target area when blobRadius changes
  updateTargetArea(): void {
    this.targetArea = Math.PI * this.blobRadius * this.blobRadius * this.weight;
  }
}
