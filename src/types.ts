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

// Water balloon physics defaults
// Key insight: gravity dominates, damping is high, collision is reactive
export const DEFAULT_FLOCK_CONFIG: FlockConfig = {
  maxSpeed: 4,             // Slower - water balloons are sluggish
  maxForce: 0.5,           // Collision response strength
  wallRepulsionRange: 60,  // Wall sensing range
  wallRepulsionStrength: 2.5,
  damping: 0.4,            // HEAVY damping - water balloons don't bounce
  blobRadius: 25,
  gravityStrength: 3.0,    // STRONG gravity - primary force
};
