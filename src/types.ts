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

// Which side of the container is open (missing wall)
export type OpeningSide = 'top' | 'bottom' | 'left' | 'right';

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

// Get the opening edge coordinates for a container
export function getOpeningEdge(bounds: ContainerBounds, opening: OpeningSide): { start: Vec2; end: Vec2 } {
  switch (opening) {
    case 'top':
      return { start: { x: bounds.x, y: bounds.y }, end: { x: bounds.x + bounds.width, y: bounds.y } };
    case 'bottom':
      return { start: { x: bounds.x, y: bounds.y + bounds.height }, end: { x: bounds.x + bounds.width, y: bounds.y + bounds.height } };
    case 'left':
      return { start: { x: bounds.x, y: bounds.y }, end: { x: bounds.x, y: bounds.y + bounds.height } };
    case 'right':
      return { start: { x: bounds.x + bounds.width, y: bounds.y }, end: { x: bounds.x + bounds.width, y: bounds.y + bounds.height } };
  }
}

// Get the center point of an opening
export function getOpeningCenter(bounds: ContainerBounds, opening: OpeningSide): Vec2 {
  const edge = getOpeningEdge(bounds, opening);
  return {
    x: (edge.start.x + edge.end.x) / 2,
    y: (edge.start.y + edge.end.y) / 2,
  };
}

// Get outward direction from an opening
export function getOpeningDirection(opening: OpeningSide): Vec2 {
  switch (opening) {
    case 'top': return { x: 0, y: -1 };
    case 'bottom': return { x: 0, y: 1 };
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
  }
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
