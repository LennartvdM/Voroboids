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

// Physics constants for fluid-like behavior
export const PHYSICS = {
  AUTOPILOT_STRENGTH: 0.35,   // Steering force toward target opening
  FLIGHT_DAMPING: 0.96,       // Damping while in flight (between containers)
  COAST_DAMPING: 0.95,        // Damping while coasting inside container
  WALL_RANGE: 25,             // Wall avoidance sensing range
  SETTLE_THRESHOLD: 0.3,      // Velocity below which considered settled
  MIN_COLLISION_DIST: 50,     // Minimum distance between voroboids
  ARC_STEERING: 0.1,          // Perpendicular steering for curved paths
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
