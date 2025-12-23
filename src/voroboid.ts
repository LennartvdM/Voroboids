// Voroboid - a bold individual particle that fills space
// Simple rules: repel neighbors, spread out, seek target container

import type { Vec2, Wall, VoroboidConfig, FlockConfig, MagnetConfig, VoroboidContent } from './types';
import { PHYSICS } from './types';
import {
  vec2, add, sub, mul, normalize, magnitude, lerpVec2, dot, pointToSegment,
  clipPolygonByPlane, polygonArea as computePolygonArea, circleToPolygon
} from './math';

// Container bounds for containment checks
export interface ContainerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Info about the target container for navigation
export interface TargetContainerInfo {
  bounds: ContainerBounds;
  center: Vec2;           // Center point of the container
}

export class Voroboid {
  id: number;
  color: string;
  weight: number;

  // Physics - in world coordinates
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;  // Keep for compatibility

  // For rendering blob shape
  blobRadius: number = 25;
  wobblePhase: number = Math.random() * Math.PI * 2;
  wobbleSpeed: number = 3 + Math.random() * 2;

  // Navigation state
  targetContainerId: string = 'a';
  isSettled: boolean = false;      // For UI feedback only

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

  // Helper: check if position is inside container bounds
  private insideContainer(pos: Vec2, bounds: ContainerBounds): boolean {
    return pos.x >= bounds.x && pos.x <= bounds.x + bounds.width &&
           pos.y >= bounds.y && pos.y <= bounds.y + bounds.height;
  }

  // Maxwell's Demon logic: determine if a wall should block based on polarity and velocity
  // inward: blocks outward movement (dot < 0 means moving out)
  // outward: blocks inward movement (dot > 0 means moving in)
  // solid: always blocks
  // permeable: never blocks
  private wallShouldBlock(wall: Wall): boolean {
    switch (wall.polarity) {
      case 'solid':
        return true;
      case 'permeable':
        return false;
      case 'inward': {
        // inward polarity = traps inside, allows entry
        // Block if velocity is going OUT (opposite to inward normal)
        const velDot = dot(this.velocity, wall.inwardNormal);
        return velDot < -0.1; // Trying to leave - blocked
      }
      case 'outward': {
        // outward polarity = releases, blocks entry
        // Block if velocity is going IN (same direction as inward normal)
        const velDot = dot(this.velocity, wall.inwardNormal);
        return velDot > 0.1; // Trying to enter - blocked
      }
      default:
        return true;
    }
  }

  // Main update - simple particle physics
  // 1. Repel from neighbors (spread out!)
  // 2. If outside target, seek the opening
  // 3. Stay away from walls
  update(
    _deltaTime: number,
    neighbors: Voroboid[],
    walls: Wall[],
    _config: FlockConfig,
    _magnet?: MagnetConfig,
    targetInfo?: TargetContainerInfo
  ): void {
    let force = vec2(0, 0);

    // FORCE 1: Pressure-driven repulsion from neighbors
    // High-pressure cells push harder - they're fighting for their fair share
    for (const neighbor of neighbors) {
      if (neighbor.id === this.id) continue;

      const diff = sub(this.position, neighbor.position);
      const dist = magnitude(diff);

      if (dist > 0 && dist < PHYSICS.REPULSION_RANGE) {
        // Linear falloff - stays strong at medium distances
        const t = 1 - dist / PHYSICS.REPULSION_RANGE;

        // Pressure-driven: compressed cells push harder
        // My pressure > 1 means I'm compressed and need to expand
        const myPressureFactor = 1 + (this.pressure - 1) * 0.4;
        // Their pressure affects how much they push back
        const theirPressureFactor = 1 + (neighbor.pressure - 1) * 0.4;
        // Net pressure differential - I push harder if I'm more compressed
        const pressureDiff = myPressureFactor / theirPressureFactor;

        const strength = PHYSICS.REPULSION_STRENGTH * t * pressureDiff;
        force = add(force, mul(normalize(diff), strength));
      }
    }

    // FORCE 2: Seek target container center if outside
    // With Maxwell's Demon walls, we seek the center directly - walls will phase us through
    if (targetInfo) {
      const isInside = this.insideContainer(this.position, targetInfo.bounds);

      if (!isInside) {
        // Seek the center (walls will let us through if polarity is right)
        const toCenter = sub(targetInfo.center, this.position);
        const dist = magnitude(toCenter);
        if (dist > 1) {
          force = add(force, mul(normalize(toCenter), PHYSICS.SEEK_STRENGTH));
        }
      }
      // Inside: repulsion from neighbors handles spreading
    }

    // FORCE 3: Wall interaction - Maxwell's Demon style
    // Walls only block if polarity doesn't allow the direction of movement
    for (const wall of walls) {
      const { point, distance } = pointToSegment(this.position, wall.start, wall.end);
      if (distance > 0 && distance < PHYSICS.WALL_RANGE) {
        // Check if this wall should block us based on polarity and velocity
        const shouldBlock = this.wallShouldBlock(wall);

        if (shouldBlock) {
          const away = normalize(sub(this.position, point));
          const strength = PHYSICS.WALL_PUSH * Math.pow(1 - distance / PHYSICS.WALL_RANGE, 2);
          force = add(force, mul(away, strength));

          // Hard boundary - don't go through blocking walls
          if (distance < 15) {
            this.position = add(point, mul(away, 15));
            // Bounce off wall
            const wallVec = sub(wall.end, wall.start);
            const wallNorm = normalize(vec2(-wallVec.y, wallVec.x));
            const velDot = dot(this.velocity, wallNorm);
            if (velDot < 0) {
              this.velocity = sub(this.velocity, mul(wallNorm, velDot * 1.5));
            }
          }
        }
        // If wall doesn't block, voroboid phases right through like a ghost
      }
    }

    // Apply force and damping
    this.velocity = add(this.velocity, force);
    this.velocity = mul(this.velocity, PHYSICS.DAMPING);

    // Speed limit
    const speed = magnitude(this.velocity);
    if (speed > PHYSICS.MAX_SPEED) {
      this.velocity = mul(normalize(this.velocity), PHYSICS.MAX_SPEED);
    }

    // Move
    this.position = add(this.position, this.velocity);

    // Settled check (for UI feedback)
    this.isSettled = speed < 0.5;

    // Update wobble
    this.wobblePhase += _deltaTime * 0.001 * this.wobbleSpeed;
  }

  // Set target container - voroboid immediately starts moving
  setTargetContainer(containerId: string, _distanceToOpening: number): void {
    if (this.targetContainerId !== containerId) {
      this.targetContainerId = containerId;
      this.isSettled = false;
      // Give an initial kick toward the new target
      // The actual seeking happens in update()
    }
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

  // Compute Voronoi-like polygon by clipping a circle against walls and neighbor bisectors
  // The cell knows only about walls and neighbors - no container bounds
  computePolygon(neighbors: Voroboid[], walls: Wall[]): void {
    // Start with a large circle around the centroid
    let polygon = circleToPolygon(this.position, this.blobRadius * 4, 24);

    // Clip against all walls - cells squeeze through openings because openings have no walls
    for (const wall of walls) {
      // Compute wall perpendicular - we keep the side where the voroboid is
      const wallVec = sub(wall.end, wall.start);
      let perpendicular = normalize(vec2(-wallVec.y, wallVec.x));

      // Check which side the voroboid is on
      const toVoroboid = sub(this.position, wall.start);
      if (dot(toVoroboid, perpendicular) > 0) {
        // perpendicular points toward voroboid, flip it so it points away
        perpendicular = mul(perpendicular, -1);
      }

      // Clip polygon - keep the voroboid's side
      polygon = clipPolygonByPlane(polygon, wall.start, perpendicular);

      if (polygon.length < 3) {
        polygon = this.getFallbackPolygon();
        break;
      }
    }

    // Clip against each neighbor's bisector
    for (const neighbor of neighbors) {
      if (neighbor.id === this.id) continue;

      // Only consider neighbors within influence range
      const dist = magnitude(sub(this.position, neighbor.position));
      if (dist > this.blobRadius * 6) continue;

      // Compute bisector position based on WEIGHT ratio (claim on space)
      // Weight determines how much territory each cell "deserves"
      // This is the core of bottom-up negotiation - weight is your inherent claim
      const weightRatio = this.weight / (this.weight + neighbor.weight);

      // Pressure provides a secondary adjustment - compressed cells push a bit harder
      const myPressure = Math.max(0.1, this.pressure);
      const theirPressure = Math.max(0.1, neighbor.pressure);
      const pressureAdjust = (myPressure / (myPressure + theirPressure)) - 0.5;

      // Combined ratio: weight is primary (80%), pressure is secondary (20%)
      const combinedRatio = weightRatio + pressureAdjust * 0.2;

      // Bisector point: lerp from this position to neighbor position
      // ratio > 0.5 means we claim more space, bisector shifts toward neighbor
      const bisectorPoint = lerpVec2(this.position, neighbor.position, combinedRatio);

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

  // Collision resolution - weight-based push when too close
  // Heavier cells move less, lighter cells get pushed more
  static resolveCollisions(voroboids: Voroboid[]): void {
    const minDist = PHYSICS.MIN_DIST;

    for (let i = 0; i < voroboids.length; i++) {
      for (let j = i + 1; j < voroboids.length; j++) {
        const a = voroboids[i];
        const b = voroboids[j];

        const diff = sub(a.position, b.position);
        const dist = magnitude(diff);

        if (dist > 0 && dist < minDist) {
          const overlap = minDist - dist;
          const pushDir = normalize(diff);

          // Weight-based separation: heavier cells move less
          const totalWeight = a.weight + b.weight;
          const aRatio = b.weight / totalWeight; // B's weight determines how much A moves
          const bRatio = a.weight / totalWeight; // A's weight determines how much B moves

          // Position correction - weighted separation
          a.position = add(a.position, mul(pushDir, overlap * 0.6 * aRatio));
          b.position = sub(b.position, mul(pushDir, overlap * 0.6 * bRatio));

          // Velocity push - also weight-based
          a.velocity = add(a.velocity, mul(pushDir, PHYSICS.COLLISION_PUSH * aRatio));
          b.velocity = sub(b.velocity, mul(pushDir, PHYSICS.COLLISION_PUSH * bRatio));
        }
      }
    }
  }
}
