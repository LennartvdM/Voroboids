// Voroboid - an autonomous agent that follows local rules
// Voronoi-like structures EMERGE from equilibrium, not pre-computation

import type { Vec2, VoroboidConfig, FlockConfig, OpeningSide, ContainerBounds } from './types';
import { vec2, add, sub, mul, normalize, magnitude, limit } from './math';

export type VoroboidMode = 'settled' | 'migrating';

export class Voroboid {
  id: number;
  color: string;
  weight: number;

  // Physics
  position: Vec2;
  velocity: Vec2;
  acceleration: Vec2;

  // Current mode
  mode: VoroboidMode = 'settled';

  // Container awareness (set by container)
  containerBounds: ContainerBounds | null = null;
  containerOpening: OpeningSide | null = null;

  // Target awareness (set when migrating)
  targetBounds: ContainerBounds | null = null;
  targetOpening: OpeningSide | null = null;
  targetAbsoluteOffset: Vec2 = vec2(0, 0); // Offset from local to absolute coords

  // For rendering blob shape
  blobRadius: number = 25;
  wobblePhase: number = Math.random() * Math.PI * 2;
  wobbleSpeed: number = 3 + Math.random() * 2;

  // Morph progress for rendering (0 = voronoi-like, 1 = blob)
  morphProgress: number = 0;

  constructor(config: VoroboidConfig) {
    this.id = config.id;
    this.color = config.color;
    this.weight = config.weight;
    this.position = vec2(0, 0);
    this.velocity = vec2(0, 0);
    this.acceleration = vec2(0, 0);
  }

  // Set current container context
  setContainer(bounds: ContainerBounds, opening: OpeningSide): void {
    this.containerBounds = bounds;
    this.containerOpening = opening;
  }

  // Start migration to target container
  startMigration(targetBounds: ContainerBounds, targetOpening: OpeningSide, absoluteOffset: Vec2): void {
    this.mode = 'migrating';
    this.targetBounds = targetBounds;
    this.targetOpening = targetOpening;
    this.targetAbsoluteOffset = absoluteOffset;
    this.morphProgress = 1; // Full blob mode while migrating
  }

  // Called when voroboid enters target container
  arriveAtTarget(): void {
    this.containerBounds = this.targetBounds;
    this.containerOpening = this.targetOpening;
    this.targetBounds = null;
    this.targetOpening = null;
    this.mode = 'settled';
  }

  // Main update - apply all forces based on local rules
  update(deltaTime: number, neighbors: Voroboid[], config: FlockConfig): void {
    this.acceleration = vec2(0, 0);

    // Always apply boid behaviors
    const separation = this.computeSeparation(neighbors, config);
    const cohesion = this.computeCohesion(neighbors, config);
    const alignment = this.computeAlignment(neighbors, config);

    this.applyForce(mul(separation, config.separationWeight * 2));
    this.applyForce(mul(cohesion, config.cohesionWeight * 0.5));
    this.applyForce(mul(alignment, config.alignmentWeight * 0.3));

    if (this.mode === 'settled' && this.containerBounds) {
      // When settled: strong wall forces, strong damping
      const wallForce = this.computeWallRepulsion(this.containerBounds, this.containerOpening, 50);
      this.applyForce(mul(wallForce, 3));

      // Damping to settle into equilibrium
      this.applyForce(mul(this.velocity, -0.15));

      // Morph toward voronoi shape
      this.morphProgress = Math.max(0, this.morphProgress - deltaTime * 0.003);

    } else if (this.mode === 'migrating') {
      // When migrating: navigate through opening, head to target

      if (this.containerBounds && this.containerOpening) {
        // Still in source container - head toward a point OUTSIDE the opening
        // This ensures they actually exit, not just reach the edge
        const exitTarget = this.getExitTarget(this.containerBounds, this.containerOpening, 60);
        const toExit = sub(exitTarget, this.position);

        // Always attract toward exit point (don't stop when close)
        const exitAttraction = mul(normalize(toExit), config.maxSpeed * 0.8);
        this.applyForce(exitAttraction);

        // Repel from walls (but not opening)
        const wallForce = this.computeWallRepulsion(this.containerBounds, this.containerOpening, 30);
        this.applyForce(mul(wallForce, 2));

        // Check if we've exited through opening
        if (this.hasExitedContainer(this.containerBounds, this.containerOpening)) {
          this.containerBounds = null;
          this.containerOpening = null;
        }
      } else if (this.targetBounds && this.targetOpening) {
        // In flight - head toward target opening
        const targetEntry = this.getExitTarget(this.targetBounds, this.targetOpening, 30);
        // Adjust for absolute positioning
        const absoluteTarget = add(targetEntry, this.targetAbsoluteOffset);
        const toTarget = sub(absoluteTarget, this.position);
        const distToTarget = magnitude(toTarget);

        // Strong attraction to target
        const targetAttraction = mul(normalize(toTarget), config.maxSpeed);
        this.applyForce(targetAttraction);

        // Light damping in flight
        this.applyForce(mul(this.velocity, -0.02));

        // Check if we've entered target container
        if (distToTarget < 30) {
          // Transition position to target container's local coords
          this.position = sub(this.position, this.targetAbsoluteOffset);
          this.arriveAtTarget();
        }
      }

      // Stay as blob while migrating
      this.morphProgress = 1;
    }

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

  // Wall repulsion: push away from solid walls (not opening)
  private computeWallRepulsion(bounds: ContainerBounds, opening: OpeningSide | null, range: number): Vec2 {
    let force = vec2(0, 0);

    // Left wall
    if (opening !== 'left') {
      const dist = this.position.x - bounds.x;
      if (dist < range && dist > 0) {
        const strength = (range - dist) / range;
        force = add(force, vec2(strength * strength, 0));
      }
    }

    // Right wall
    if (opening !== 'right') {
      const dist = (bounds.x + bounds.width) - this.position.x;
      if (dist < range && dist > 0) {
        const strength = (range - dist) / range;
        force = add(force, vec2(-strength * strength, 0));
      }
    }

    // Top wall
    if (opening !== 'top') {
      const dist = this.position.y - bounds.y;
      if (dist < range && dist > 0) {
        const strength = (range - dist) / range;
        force = add(force, vec2(0, strength * strength));
      }
    }

    // Bottom wall
    if (opening !== 'bottom') {
      const dist = (bounds.y + bounds.height) - this.position.y;
      if (dist < range && dist > 0) {
        const strength = (range - dist) / range;
        force = add(force, vec2(0, -strength * strength));
      }
    }

    return force;
  }

  // Get a target point OUTSIDE the container through the opening
  // This ensures voroboids are attracted past the edge, not just to it
  private getExitTarget(bounds: ContainerBounds, opening: OpeningSide, distance: number): Vec2 {
    switch (opening) {
      case 'top': return vec2(bounds.x + bounds.width / 2, bounds.y - distance);
      case 'bottom': return vec2(bounds.x + bounds.width / 2, bounds.y + bounds.height + distance);
      case 'left': return vec2(bounds.x - distance, bounds.y + bounds.height / 2);
      case 'right': return vec2(bounds.x + bounds.width + distance, bounds.y + bounds.height / 2);
    }
  }

  // Check if voroboid has exited container through opening
  private hasExitedContainer(bounds: ContainerBounds, opening: OpeningSide): boolean {
    switch (opening) {
      case 'top': return this.position.y < bounds.y - 10;
      case 'bottom': return this.position.y > bounds.y + bounds.height + 10;
      case 'left': return this.position.x < bounds.x - 10;
      case 'right': return this.position.x > bounds.x + bounds.width + 10;
    }
  }

  // Get current shape for rendering
  getCurrentShape(): Vec2[] {
    // When morphProgress is low, return a more angular shape
    // When high, return wobbly blob
    // The actual "voronoi" structure emerges from positions, not from polygon computation
    return this.getBlobShape();
  }

  // Generate wobbly blob shape
  private getBlobShape(): Vec2[] {
    const points: Vec2[] = [];
    const segments = 16;

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;

      // More wobble when blob mode, less when settled
      const wobbleAmount = 0.05 + this.morphProgress * 0.15;
      const wobble = Math.sin(angle * 3 + this.wobblePhase) * wobbleAmount +
                     Math.sin(angle * 5 + this.wobblePhase * 1.3) * wobbleAmount * 0.5;

      // Radius varies with morph progress - more circular when blob
      const baseRadius = this.blobRadius * (0.8 + this.morphProgress * 0.2);
      const radius = baseRadius * (1 + wobble);

      points.push({
        x: this.position.x + Math.cos(angle) * radius,
        y: this.position.y + Math.sin(angle) * radius,
      });
    }

    return points;
  }
}
