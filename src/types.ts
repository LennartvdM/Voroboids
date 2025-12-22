// Core types for Voroboids

export interface Vec2 {
  x: number;
  y: number;
}

export interface BezierPath {
  start: Vec2;
  control1: Vec2;
  control2: Vec2;
  end: Vec2;
}

// A wall is just a line segment that repels voroboids
export interface Wall {
  start: Vec2;
  end: Vec2;
}

export interface VoroboidConfig {
  id: number;
  color: string;
  weight: number;
}

export interface FlockConfig {
  // Boid behavior weights
  separationWeight: number;
  alignmentWeight: number;
  cohesionWeight: number;

  // Movement
  maxSpeed: number;
  maxForce: number;

  // Wall interaction
  wallRepulsionRange: number;
  wallRepulsionStrength: number;

  // Damping (how quickly they settle)
  damping: number;

  // Blob appearance
  blobRadius: number;
}

export const DEFAULT_FLOCK_CONFIG: FlockConfig = {
  separationWeight: 1.5,
  alignmentWeight: 1.0,
  cohesionWeight: 1.0,
  maxSpeed: 6,
  maxForce: 0.3,
  wallRepulsionRange: 50,
  wallRepulsionStrength: 2.0,
  damping: 0.02,
  blobRadius: 25,
};
