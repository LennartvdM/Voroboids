// Container - a Maxwell's Demon region with directional walls
// All 4 walls are present, but their polarity determines permeability
// inward = traps cells inside (they can enter but not leave)
// outward = releases cells (they can leave but not enter)

import type { Vec2, Wall, WallPolarity, MagnetConfig } from './types';
import { vec2 } from './math';

export class Container {
  // Position in world space (relative to world canvas origin)
  worldX: number = 0;
  worldY: number = 0;
  width: number;
  height: number;

  // DOM element for position tracking
  element: HTMLElement;

  // Current wall polarity for all walls
  private wallPolarity: WallPolarity = 'inward';

  // The actual wall segments (all 4 walls present)
  walls: Wall[] = [];

  // Magnet - gravity attractor at center
  magnet: MagnetConfig;

  constructor(element: HTMLElement) {
    this.element = element;
    this.width = element.offsetWidth;
    this.height = element.offsetHeight;
    this.magnet = {
      position: vec2(0, 0),
      strength: 0.5,
    };
    this.updateMagnet();
  }

  // Update magnet position to center of container
  private updateMagnet(): void {
    const centerX = this.worldX + this.width / 2;
    const centerY = this.worldY + this.height / 2;
    this.magnet.position = vec2(centerX, centerY);
  }

  // Update position relative to a reference element (world container)
  updatePosition(worldOrigin: DOMRect): void {
    const rect = this.element.getBoundingClientRect();
    this.worldX = rect.left - worldOrigin.left;
    this.worldY = rect.top - worldOrigin.top;
    this.width = rect.width;
    this.height = rect.height;
    this.rebuildWalls();
    this.updateMagnet();
  }

  // Build all 4 wall segments with current polarity
  rebuildWalls(): void {
    this.walls = [];
    const x = this.worldX;
    const y = this.worldY;
    const w = this.width;
    const h = this.height;

    // Top wall - inward normal points down
    this.walls.push({
      start: vec2(x, y),
      end: vec2(x + w, y),
      polarity: this.wallPolarity,
      inwardNormal: vec2(0, 1)
    });

    // Right wall - inward normal points left
    this.walls.push({
      start: vec2(x + w, y),
      end: vec2(x + w, y + h),
      polarity: this.wallPolarity,
      inwardNormal: vec2(-1, 0)
    });

    // Bottom wall - inward normal points up
    this.walls.push({
      start: vec2(x + w, y + h),
      end: vec2(x, y + h),
      polarity: this.wallPolarity,
      inwardNormal: vec2(0, -1)
    });

    // Left wall - inward normal points right
    this.walls.push({
      start: vec2(x, y + h),
      end: vec2(x, y),
      polarity: this.wallPolarity,
      inwardNormal: vec2(1, 0)
    });
  }

  // Set polarity for all walls
  setPolarity(polarity: WallPolarity): void {
    this.wallPolarity = polarity;
    // Update existing walls
    for (const wall of this.walls) {
      wall.polarity = polarity;
    }
  }

  // Get current polarity
  getPolarity(): WallPolarity {
    return this.wallPolarity;
  }

  // Get bounds for spawning voroboids inside
  getBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.worldX,
      y: this.worldY,
      width: this.width,
      height: this.height,
    };
  }

  // Get magnet info for gravity calculations
  getMagnet(): MagnetConfig {
    return this.magnet;
  }

  // Check if a point is inside this container
  containsPoint(point: Vec2): boolean {
    return (
      point.x >= this.worldX &&
      point.x <= this.worldX + this.width &&
      point.y >= this.worldY &&
      point.y <= this.worldY + this.height
    );
  }

  // Get the center of the container
  getCenter(): Vec2 {
    return vec2(
      this.worldX + this.width / 2,
      this.worldY + this.height / 2
    );
  }
}
