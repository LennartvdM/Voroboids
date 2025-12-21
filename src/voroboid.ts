// Individual Voroboid - a cell that can morph between voronoi and blob

import type { Vec2, VoroboidState, VoroboidConfig, BezierPath, FlockConfig } from './types';
import { vec2, add, sub, mul, normalize, magnitude, limit, bezierPoint, easeOutCubic, easeOutBack, smoothstep } from './math';

export class Voroboid {
  id: number;
  color: string;
  weight: number;

  // Position & motion
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;

  // State machine
  state: VoroboidState = 'contained';

  // Voronoi cell polygon (when contained/settling)
  cellPolygon: Vec2[] = [];
  cellCenter: Vec2 = vec2(0, 0);

  // Flight path
  flightPath: BezierPath | null = null;
  flightProgress: number = 0;
  flightDuration: number = 1500; // ms

  // Animation timing
  launchDelay: number = 0;
  stateStartTime: number = 0;
  morphProgress: number = 0; // 0 = voronoi, 1 = blob

  // Blob appearance
  blobRadius: number = 20;
  wobblePhase: number = Math.random() * Math.PI * 2;
  wobbleSpeed: number = 3 + Math.random() * 2;

  // Target for settling
  targetCell: Vec2[] = [];
  targetCenter: Vec2 = vec2(0, 0);

  constructor(config: VoroboidConfig) {
    this.id = config.id;
    this.color = config.color;
    this.weight = config.weight;
    this.position = vec2(0, 0);
    this.velocity = vec2(0, 0);
    this.acceleration = vec2(0, 0);
  }

  // Set cell polygon from voronoi computation
  setCell(polygon: Vec2[], center: Vec2): void {
    this.cellPolygon = polygon;
    this.cellCenter = center;
    this.position = { ...center };
  }

  // Prepare for launch with delay and path
  prepareLaunch(delay: number, path: BezierPath, duration: number): void {
    this.launchDelay = delay;
    this.flightPath = path;
    this.flightDuration = duration;
    this.flightProgress = 0;
    this.state = 'launching';
    this.stateStartTime = performance.now();
  }

  // Set target cell for settling
  setTargetCell(polygon: Vec2[], center: Vec2): void {
    this.targetCell = polygon;
    this.targetCenter = center;
  }

  // Apply boid steering force
  applyForce(force: Vec2): void {
    this.acceleration = add(this.acceleration, force);
  }

  // Update based on current state
  update(deltaTime: number, currentTime: number, config: FlockConfig, neighbors: Voroboid[]): void {
    const elapsed = currentTime - this.stateStartTime;

    switch (this.state) {
      case 'contained':
        // Static in voronoi cell
        this.morphProgress = 0;
        break;

      case 'launching':
        // Waiting to launch, morphing to blob
        if (elapsed >= this.launchDelay) {
          this.state = 'flying';
          this.stateStartTime = currentTime;
          this.morphProgress = 1;
        } else {
          // Morph from voronoi to blob while waiting
          this.morphProgress = smoothstep(0, this.launchDelay * 0.8, elapsed);
          // Slight wobble anticipation
          const wobble = Math.sin(elapsed * 0.01) * 2;
          this.position = add(this.cellCenter, vec2(wobble, wobble * 0.5));
        }
        break;

      case 'flying':
        // Follow bezier path with boid behaviors
        if (this.flightPath) {
          const pathElapsed = currentTime - this.stateStartTime;
          this.flightProgress = Math.min(1, pathElapsed / this.flightDuration);

          if (this.flightProgress >= 1) {
            this.state = 'arriving';
            this.stateStartTime = currentTime;
          } else {
            // Base position from bezier curve
            const eased = easeOutCubic(this.flightProgress);
            const basePos = bezierPoint(this.flightPath, eased);
            // Tangent available for future use: bezierTangent(this.flightPath, eased)

            // Apply boid behaviors for organic movement
            this.applyBoidBehaviors(neighbors, config);

            // Update velocity and position
            this.velocity = add(this.velocity, this.acceleration);
            this.velocity = limit(this.velocity, config.maxSpeed);

            // Blend bezier path with boid movement
            // Early in flight: more bezier, late in flight: more bezier (less boid chaos at endpoints)
            const boidInfluence = Math.sin(this.flightProgress * Math.PI) * 0.3;
            this.position = add(
              mul(basePos, 1 - boidInfluence),
              mul(add(basePos, this.velocity), boidInfluence)
            );

            // Reset acceleration
            this.acceleration = vec2(0, 0);
          }
        }
        this.morphProgress = 1;
        break;

      case 'arriving':
        // Quick settle into position
        const arriveElapsed = currentTime - this.stateStartTime;
        const arriveDuration = 400;

        if (arriveElapsed >= arriveDuration) {
          this.state = 'settling';
          this.stateStartTime = currentTime;
        } else {
          // Move towards target center with easing
          const t = easeOutBack(arriveElapsed / arriveDuration);
          this.position = {
            x: this.position.x + (this.targetCenter.x - this.position.x) * 0.15,
            y: this.position.y + (this.targetCenter.y - this.position.y) * 0.15,
          };
          this.morphProgress = 1 - t * 0.3;
        }
        break;

      case 'settling':
        // Morph from blob back to voronoi
        const settleElapsed = currentTime - this.stateStartTime;
        const settleDuration = 600;

        this.morphProgress = Math.max(0, 1 - settleElapsed / settleDuration);
        this.position = {
          x: this.position.x + (this.targetCenter.x - this.position.x) * 0.2,
          y: this.position.y + (this.targetCenter.y - this.position.y) * 0.2,
        };

        if (settleElapsed >= settleDuration) {
          this.state = 'contained';
          this.cellPolygon = this.targetCell;
          this.cellCenter = this.targetCenter;
          this.position = { ...this.targetCenter };
        }
        break;
    }

    // Update wobble phase
    this.wobblePhase += deltaTime * 0.001 * this.wobbleSpeed;
  }

  // Craig Reynolds boid behaviors
  private applyBoidBehaviors(neighbors: Voroboid[], config: FlockConfig): void {
    const separation = this.separate(neighbors, config);
    const alignment = this.align(neighbors, config);
    const cohesion = this.cohere(neighbors, config);

    this.applyForce(mul(separation, config.separationWeight));
    this.applyForce(mul(alignment, config.alignmentWeight));
    this.applyForce(mul(cohesion, config.cohesionWeight));
  }

  // Separation: steer to avoid crowding neighbors
  private separate(neighbors: Voroboid[], config: FlockConfig): Vec2 {
    const desiredSeparation = config.blobRadius * 2.5;
    let steer = vec2(0, 0);
    let count = 0;

    for (const other of neighbors) {
      if (other.id === this.id || other.state !== 'flying') continue;

      const d = magnitude(sub(this.position, other.position));
      if (d > 0 && d < desiredSeparation) {
        const diff = normalize(sub(this.position, other.position));
        steer = add(steer, mul(diff, 1 / d));
        count++;
      }
    }

    if (count > 0) {
      steer = div(steer, count);
      steer = normalize(steer);
      steer = mul(steer, config.maxSpeed);
      steer = sub(steer, this.velocity);
      steer = limit(steer, config.maxForce);
    }

    return steer;
  }

  // Alignment: steer towards average heading of neighbors
  private align(neighbors: Voroboid[], config: FlockConfig): Vec2 {
    const neighborDist = config.blobRadius * 5;
    let sum = vec2(0, 0);
    let count = 0;

    for (const other of neighbors) {
      if (other.id === this.id || other.state !== 'flying') continue;

      const d = magnitude(sub(this.position, other.position));
      if (d > 0 && d < neighborDist) {
        sum = add(sum, other.velocity);
        count++;
      }
    }

    if (count > 0) {
      sum = div(sum, count);
      sum = normalize(sum);
      sum = mul(sum, config.maxSpeed);
      let steer = sub(sum, this.velocity);
      steer = limit(steer, config.maxForce);
      return steer;
    }

    return vec2(0, 0);
  }

  // Cohesion: steer towards average position of neighbors
  private cohere(neighbors: Voroboid[], config: FlockConfig): Vec2 {
    const neighborDist = config.blobRadius * 5;
    let sum = vec2(0, 0);
    let count = 0;

    for (const other of neighbors) {
      if (other.id === this.id || other.state !== 'flying') continue;

      const d = magnitude(sub(this.position, other.position));
      if (d > 0 && d < neighborDist) {
        sum = add(sum, other.position);
        count++;
      }
    }

    if (count > 0) {
      sum = div(sum, count);
      return this.seek(sum, config);
    }

    return vec2(0, 0);
  }

  // Seek: steer towards a target
  private seek(target: Vec2, config: FlockConfig): Vec2 {
    const desired = sub(target, this.position);
    const d = magnitude(desired);

    if (d > 0) {
      const normalized = normalize(desired);
      const scaled = mul(normalized, config.maxSpeed);
      const steer = sub(scaled, this.velocity);
      return limit(steer, config.maxForce);
    }

    return vec2(0, 0);
  }

  // Get current shape for rendering (interpolated between cell and blob)
  getCurrentShape(time: number): Vec2[] {
    if (this.morphProgress <= 0) {
      return this.cellPolygon;
    }

    if (this.morphProgress >= 1) {
      return this.getBlobShape(time);
    }

    // Interpolate between voronoi cell and blob
    const blobShape = this.getBlobShape(time);
    const cellShape = this.cellPolygon;

    // Match point counts for interpolation
    const targetPoints = Math.max(blobShape.length, cellShape.length);
    const normalizedCell = this.resamplePolygon(cellShape, targetPoints);
    const normalizedBlob = this.resamplePolygon(blobShape, targetPoints);

    return normalizedCell.map((cellPt, i) => ({
      x: cellPt.x + (normalizedBlob[i].x - cellPt.x) * this.morphProgress,
      y: cellPt.y + (normalizedBlob[i].y - cellPt.y) * this.morphProgress,
    }));
  }

  // Generate wobbly blob shape
  private getBlobShape(_time: number): Vec2[] {
    const points: Vec2[] = [];
    const segments = 24;

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const wobble = Math.sin(angle * 3 + this.wobblePhase) * 0.15 +
                     Math.sin(angle * 5 + this.wobblePhase * 1.3) * 0.08;
      const radius = this.blobRadius * (1 + wobble);

      points.push({
        x: this.position.x + Math.cos(angle) * radius,
        y: this.position.y + Math.sin(angle) * radius,
      });
    }

    return points;
  }

  // Resample polygon to have specific number of points
  private resamplePolygon(polygon: Vec2[], targetCount: number): Vec2[] {
    if (polygon.length === 0) return [];
    if (polygon.length === targetCount) return polygon;

    const result: Vec2[] = [];
    const totalLength = this.getPolygonPerimeter(polygon);
    const segmentLength = totalLength / targetCount;

    let currentDist = 0;
    let polyIndex = 0;

    for (let i = 0; i < targetCount; i++) {
      const targetDist = i * segmentLength;

      while (currentDist < targetDist && polyIndex < polygon.length) {
        const p1 = polygon[polyIndex];
        const p2 = polygon[(polyIndex + 1) % polygon.length];
        const edgeLength = magnitude(sub(p2, p1));

        if (currentDist + edgeLength >= targetDist) {
          const t = (targetDist - currentDist) / edgeLength;
          result.push({
            x: p1.x + (p2.x - p1.x) * t,
            y: p1.y + (p2.y - p1.y) * t,
          });
          break;
        }

        currentDist += edgeLength;
        polyIndex++;
      }

      if (result.length <= i) {
        result.push(polygon[i % polygon.length]);
      }
    }

    return result;
  }

  private getPolygonPerimeter(polygon: Vec2[]): number {
    let perimeter = 0;
    for (let i = 0; i < polygon.length; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % polygon.length];
      perimeter += magnitude(sub(p2, p1));
    }
    return perimeter;
  }
}

// Helper needed in boid behaviors
function div(v: Vec2, scalar: number): Vec2 {
  return scalar !== 0 ? { x: v.x / scalar, y: v.y / scalar } : { x: 0, y: 0 };
}
