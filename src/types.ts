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

export type VoroboidState = 'contained' | 'launching' | 'flying' | 'arriving' | 'settling';

export interface VoroboidConfig {
  id: number;
  color: string;
  weight: number; // Determines cell size in voronoi
}

export interface ContainerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlockConfig {
  // Boid behavior weights
  separationWeight: number;
  alignmentWeight: number;
  cohesionWeight: number;

  // Timing
  staggerMean: number;      // Mean delay for normal distribution
  staggerStdDev: number;    // Standard deviation for launch timing

  // Movement
  maxSpeed: number;
  maxForce: number;

  // Blob appearance
  blobRadius: number;
  blobWobbleFreq: number;
  blobWobbleAmp: number;
}

export const DEFAULT_FLOCK_CONFIG: FlockConfig = {
  separationWeight: 1.5,
  alignmentWeight: 1.0,
  cohesionWeight: 1.0,
  staggerMean: 500,
  staggerStdDev: 200,
  maxSpeed: 8,
  maxForce: 0.3,
  blobRadius: 20,
  blobWobbleFreq: 3,
  blobWobbleAmp: 0.15,
};
