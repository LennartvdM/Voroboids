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
  polygon: Vec2[] = [];              // Computed boundary vertices
  targetArea: number = 2500;         // Desired area (based on blobRadius^2 * π)
  currentArea: number = 0;           // Actual area of current polygon
  pressure: number = 1;              // Internal pressure = targetArea / currentArea

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
  // Water balloon physics: gravity (primary) + collision (reactive) + wall (constraint)
  update(deltaTime: number, neighbors: Voroboid[], walls: Wall[], config: FlockConfig, magnet?: MagnetConfig): void {
    this.acceleration = vec2(0, 0);

    // 1. GRAVITY - the primary force, always pulling toward magnet
    if (magnet) {
      const gravityForce = this.computeGravity(magnet, config);
      this.applyForce(gravityForce);
    }

    // 2. COLLISION - reactive force, only when overlapping neighbors
    const collisionForce = this.computeCollisionForce(neighbors, config);
    this.applyForce(collisionForce);

    // 3. WALL REPULSION - stay inside container
    const wallForce = this.computeWallRepulsion(walls, config);
    this.applyForce(mul(wallForce, config.wallRepulsionStrength));

    // 4. HEAVY DAMPING - water balloons don't bounce
    this.applyForce(mul(this.velocity, -config.damping));

    // Integrate physics
    this.velocity = add(this.velocity, this.acceleration);
    this.velocity = limit(this.velocity, config.maxSpeed);
    this.position = add(this.position, mul(this.velocity, deltaTime * 0.06));

    // Hard constraints - position correction
    this.resolveCollisions(neighbors);
    this.constrainToWalls(walls, config);

    // Settling detection
    this.checkSettled(deltaTime);

    // Update wobble (for fallback rendering)
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

  // Collision force: push away from overlapping neighbors
  // This is reactive - only applies when voroboids are too close
  private computeCollisionForce(neighbors: Voroboid[], config: FlockConfig): Vec2 {
    const minDistance = this.blobRadius * 2.0;  // Collision threshold
    let force = vec2(0, 0);

    for (const other of neighbors) {
      if (other.id === this.id) continue;

      const diff = sub(this.position, other.position);
      const dist = magnitude(diff);

      if (dist > 0 && dist < minDistance) {
        // Overlap! Apply repulsion force
        const overlap = minDistance - dist;
        const direction = normalize(diff);
        // Force proportional to overlap (spring-like)
        const repulsion = mul(direction, overlap * 0.5);
        force = add(force, repulsion);
      }
    }

    return limit(force, config.maxForce * 2);
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

    // Direct polygon update - smoothness comes from physics (high damping), not interpolation
    this.polygon = polygon;

    // Update current area and pressure
    this.currentArea = Math.abs(computePolygonArea(this.polygon));
    if (this.currentArea > 0) {
      this.pressure = this.targetArea / this.currentArea;
    } else {
      this.pressure = 1;
    }
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
