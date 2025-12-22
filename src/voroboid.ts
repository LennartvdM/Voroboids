// Voroboid - an autonomous organism with simple, consistent rules
// No modes, no phases - just physics that always applies

import type { Vec2, Wall, VoroboidConfig, FlockConfig } from './types';
import { vec2, add, sub, mul, normalize, magnitude, limit, pointToSegment } from './math';

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

  constructor(config: VoroboidConfig) {
    this.id = config.id;
    this.color = config.color;
    this.weight = config.weight;
    this.position = vec2(0, 0);
    this.velocity = vec2(0, 0);
    this.acceleration = vec2(0, 0);
  }

  // Main update - apply all forces based on local rules
  // The voroboid doesn't know about containers - just walls and neighbors
  update(deltaTime: number, neighbors: Voroboid[], walls: Wall[], config: FlockConfig): void {
    this.acceleration = vec2(0, 0);

    // Boid behaviors - always active
    const separation = this.computeSeparation(neighbors, config);
    const cohesion = this.computeCohesion(neighbors, config);
    const alignment = this.computeAlignment(neighbors, config);

    this.applyForce(mul(separation, config.separationWeight));
    this.applyForce(mul(cohesion, config.cohesionWeight));
    this.applyForce(mul(alignment, config.alignmentWeight));

    // Wall repulsion - always active for all walls
    const wallForce = this.computeWallRepulsion(walls, config);
    this.applyForce(mul(wallForce, config.wallRepulsionStrength));

    // Light damping - allows movement but prevents chaos
    this.applyForce(mul(this.velocity, -config.damping));

    // Integrate physics
    this.velocity = add(this.velocity, this.acceleration);
    this.velocity = limit(this.velocity, config.maxSpeed);
    this.position = add(this.position, mul(this.velocity, deltaTime * 0.06));

    // Update wobble
    this.wobblePhase += deltaTime * 0.001 * this.wobbleSpeed;
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

  // Get current shape for rendering - wobbly blob
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
}
