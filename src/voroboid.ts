// Voroboid - an autonomous organism with intent-based movement
// Key behavior: cells steer toward their target, enter fast, and settle naturally

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
  opening: Vec2;          // Center point of the opening
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

  // Navigation state - voroboids have intent
  targetContainerId: string = 'a';
  departureDelay: number = 0;      // Frames until departure begins
  departed: boolean = false;       // Has started moving toward target
  isSettled: boolean = false;      // Has stopped moving

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

  // Main update - intent-based movement
  // Inside target: coast with momentum, walls stop movement
  // Outside target: autopilot steering toward opening
  update(
    _deltaTime: number,
    _neighbors: Voroboid[],
    walls: Wall[],
    config: FlockConfig,
    _magnet?: MagnetConfig,
    targetInfo?: TargetContainerInfo
  ): void {
    // If no target info, fall back to legacy behavior
    if (!targetInfo) {
      this.updateLegacy(_deltaTime, walls, config);
      return;
    }

    const isInside = this.insideContainer(this.position, targetInfo.bounds);

    // Handle departure delay - wait before starting to move
    if (!this.departed && !isInside) {
      this.departureDelay--;
      if (this.departureDelay > 0) {
        return; // Still waiting
      }
      this.departed = true;
      this.isSettled = false;
    }

    if (isInside) {
      // INSIDE TARGET CONTAINER: Coast with momentum
      // Light damping - momentum carries them to different spots
      this.velocity = mul(this.velocity, PHYSICS.COAST_DAMPING);

      // Only walls stop them - hard collision
      for (const wall of walls) {
        const { point, distance } = pointToSegment(this.position, wall.start, wall.end);
        const margin = 20;
        if (distance < margin && distance > 0) {
          // Push out of wall
          const away = normalize(sub(this.position, point));
          this.position = add(point, mul(away, margin));
          // Hit wall = stop completely
          this.velocity = vec2(0, 0);
        }
      }

      // Check if settled
      if (magnitude(this.velocity) < PHYSICS.SETTLE_THRESHOLD) {
        this.isSettled = true;
      }

      // Reset departure state when inside
      this.departed = false;

    } else {
      // OUTSIDE TARGET: Autopilot steering toward opening
      const toOpening = sub(targetInfo.opening, this.position);
      const dist = magnitude(toOpening);
      let steer = vec2(0, 0);

      if (dist > 1) {
        // Desired velocity toward opening
        const desired = mul(normalize(toOpening), config.maxSpeed);
        const steerForce = sub(desired, this.velocity);
        steer = add(steer, mul(normalize(steerForce), PHYSICS.AUTOPILOT_STRENGTH));
      }

      // Arc steering for curved, natural paths (based on odd/even id)
      if (dist > 50) {
        const perp = vec2(-toOpening.y, toOpening.x);
        const arcSign = (this.id % 2 === 0) ? 1 : -1;
        steer = add(steer, mul(normalize(perp), arcSign * PHYSICS.ARC_STEERING));
      }

      // Wall avoidance during flight (no cell collision)
      for (const wall of walls) {
        const { point, distance } = pointToSegment(this.position, wall.start, wall.end);
        if (distance < PHYSICS.WALL_RANGE && distance > 0) {
          const away = normalize(sub(this.position, point));
          const strength = Math.pow((PHYSICS.WALL_RANGE - distance) / PHYSICS.WALL_RANGE, 2) * 0.8;
          steer = add(steer, mul(away, strength));
        }
      }

      // Apply steering with flight damping
      this.velocity = mul(add(this.velocity, steer), PHYSICS.FLIGHT_DAMPING);
    }

    // Integrate position
    this.position = add(this.position, this.velocity);

    // Update wobble (for fallback rendering)
    this.wobblePhase += _deltaTime * 0.001 * this.wobbleSpeed;
  }

  // Legacy update for backwards compatibility (when no target info provided)
  private updateLegacy(deltaTime: number, walls: Wall[], _config: FlockConfig): void {
    // Simple coast behavior
    this.velocity = mul(this.velocity, PHYSICS.COAST_DAMPING);

    // Wall constraints
    for (const wall of walls) {
      const { point, distance } = pointToSegment(this.position, wall.start, wall.end);
      const margin = 20;
      if (distance < margin && distance > 0) {
        const away = normalize(sub(this.position, point));
        this.position = add(point, mul(away, margin));
        this.velocity = vec2(0, 0);
      }
    }

    this.position = add(this.position, this.velocity);
    this.wobblePhase += deltaTime * 0.001 * this.wobbleSpeed;
  }

  // Set target container and initiate departure
  setTargetContainer(containerId: string, distanceToOpening: number): void {
    if (this.targetContainerId !== containerId) {
      this.targetContainerId = containerId;
      // Departure delay based on distance - creates staggered, natural flow
      this.departureDelay = Math.floor(distanceToOpening / 8);
      this.departed = false;
      this.isSettled = false;
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

  // Simple collision resolution - just respect each other's space, no bounce
  // Called after all voroboids have updated their positions
  static resolveCollisions(voroboids: Voroboid[]): void {
    const minDist = PHYSICS.MIN_COLLISION_DIST;

    for (let i = 0; i < voroboids.length; i++) {
      for (let j = i + 1; j < voroboids.length; j++) {
        const a = voroboids[i];
        const b = voroboids[j];

        const diff = sub(a.position, b.position);
        const dist = magnitude(diff);

        if (dist > 0 && dist < minDist) {
          // Push apart - each moves half the overlap distance
          const fix = mul(normalize(diff), (minDist - dist) * 0.5);
          a.position = add(a.position, fix);
          b.position = sub(b.position, fix);
        }
      }
    }
  }
}
