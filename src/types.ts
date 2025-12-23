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

// Wall polarity - Maxwell's Demon style directional permeability
// inward: blocks cells trying to escape, allows cells entering (trapping)
// outward: blocks cells trying to enter, allows cells escaping (releasing)
// solid: blocks all passage
// permeable: allows all passage
export type WallPolarity = 'inward' | 'outward' | 'solid' | 'permeable';

// A wall is a line segment with directional permeability
export interface Wall {
  start: Vec2;
  end: Vec2;
  polarity: WallPolarity;
  // Normal pointing INTO the container (used for polarity checks)
  inwardNormal: Vec2;
}

// Content that a voroboid can display
export type VoroboidContent =
  | { type: 'color'; color: string }          // Solid color fill
  | { type: 'image'; src: string }            // Image (URL or data URI)
  | { type: 'text'; text: string; fontSize?: number; fontColor?: string }  // Text content
  | { type: 'gradient'; colors: string[] };   // Gradient fill

export interface VoroboidConfig {
  id: number;
  color: string;
  weight: number;
  content?: VoroboidContent;  // Optional content to display
}

export interface FlockConfig {
  // Movement
  maxSpeed: number;
  maxForce: number;

  // Wall interaction
  wallRepulsionRange: number;
  wallRepulsionStrength: number;

  // Damping - water balloons are heavy, they don't bounce
  damping: number;

  // Blob appearance
  blobRadius: number;

  // Gravity toward container magnet - PRIMARY force
  gravityStrength: number;
}

// Magnet configuration for containers
export interface MagnetConfig {
  position: Vec2;        // Point attractor in container space
  strength: number;      // Pull force (overrides config if set)
  direction?: Vec2;      // Optional: directional gravity instead of point
}

// Physics constants - voroboids are bold individuals that fill space
export const PHYSICS = {
  // Movement
  DAMPING: 0.94,              // Friction
  MAX_SPEED: 6,               // Speed limit

  // Repulsion - THE spreading force (linear falloff, not quadratic)
  REPULSION_RANGE: 100,       // How far they sense each other
  REPULSION_STRENGTH: 1.2,    // Strong push apart

  // Wall interaction
  WALL_RANGE: 35,             // Wall sensing range
  WALL_PUSH: 2.0,             // Wall repulsion strength

  // Navigation
  SEEK_STRENGTH: 0.4,         // Force toward target when outside

  // Collision - hard push when too close
  MIN_DIST: 45,               // Minimum distance between centers
  COLLISION_PUSH: 0.4,        // Velocity added on collision
};

// Water balloon physics defaults
// Key insight: gravity dominates, damping is high, collision is reactive
export const DEFAULT_FLOCK_CONFIG: FlockConfig = {
  maxSpeed: 10,            // Higher max speed for fluid movement
  maxForce: 0.5,           // Collision response strength
  wallRepulsionRange: 25,  // Wall sensing range (matches WALL_RANGE)
  wallRepulsionStrength: 2.5,
  damping: 0.4,            // Legacy damping (used in force-based mode)
  blobRadius: 25,
  gravityStrength: 3.0,    // Gravity strength
};
