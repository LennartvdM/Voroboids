// Container - a region in world space that defines walls
// Containers don't render - they just define geometry

import type { Vec2, Wall, MagnetConfig } from './types';
import { vec2 } from './math';

export type OpeningSide = 'top' | 'bottom' | 'left' | 'right';

export class Container {
  // Position in world space (relative to world canvas origin)
  worldX: number = 0;
  worldY: number = 0;
  width: number;
  height: number;

  // DOM element for position tracking
  element: HTMLElement;

  // Which side is open (no wall)
  opening: OpeningSide;

  // The actual wall segments (3 walls, gap on opening side)
  walls: Wall[] = [];

  // Magnet - gravity attractor (opposite side of opening)
  magnet: MagnetConfig;

  constructor(element: HTMLElement, opening: OpeningSide) {
    this.element = element;
    this.opening = opening;
    this.width = element.offsetWidth;
    this.height = element.offsetHeight;
    this.magnet = {
      position: vec2(0, 0),
      strength: 0.5,
    };
    this.updateMagnet();
  }

  // Update magnet position based on opening side
  // Magnet is on the opposite side of the opening (gravity pulls toward it)
  private updateMagnet(): void {
    const centerX = this.worldX + this.width / 2;
    const centerY = this.worldY + this.height / 2;

    // Magnet position is on the wall opposite to the opening
    switch (this.opening) {
      case 'top':
        // Opening at top, magnet at bottom
        this.magnet.position = vec2(centerX, this.worldY + this.height);
        this.magnet.direction = vec2(0, 1);
        break;
      case 'bottom':
        // Opening at bottom, magnet at top
        this.magnet.position = vec2(centerX, this.worldY);
        this.magnet.direction = vec2(0, -1);
        break;
      case 'left':
        // Opening at left, magnet at right
        this.magnet.position = vec2(this.worldX + this.width, centerY);
        this.magnet.direction = vec2(1, 0);
        break;
      case 'right':
        // Opening at right, magnet at left
        this.magnet.position = vec2(this.worldX, centerY);
        this.magnet.direction = vec2(-1, 0);
        break;
    }
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

  // Build wall segments based on opening side
  rebuildWalls(): void {
    this.walls = [];
    const x = this.worldX;
    const y = this.worldY;
    const w = this.width;
    const h = this.height;

    // Add walls for closed sides
    if (this.opening !== 'top') {
      this.walls.push({ start: vec2(x, y), end: vec2(x + w, y) });
    }
    if (this.opening !== 'right') {
      this.walls.push({ start: vec2(x + w, y), end: vec2(x + w, y + h) });
    }
    if (this.opening !== 'bottom') {
      this.walls.push({ start: vec2(x + w, y + h), end: vec2(x, y + h) });
    }
    if (this.opening !== 'left') {
      this.walls.push({ start: vec2(x, y + h), end: vec2(x, y) });
    }
  }

  // Rotate opening: right -> bottom -> left -> top -> right
  rotateOpening(): void {
    const sequence: OpeningSide[] = ['right', 'bottom', 'left', 'top'];
    const currentIndex = sequence.indexOf(this.opening);
    this.opening = sequence[(currentIndex + 1) % 4];
    this.rebuildWalls();
    this.updateMagnet();
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
}
