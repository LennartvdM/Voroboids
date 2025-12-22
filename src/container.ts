// Container - a region in world space that defines walls
// Containers don't render - they just define geometry

import type { Wall } from './types';
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

  constructor(element: HTMLElement, opening: OpeningSide) {
    this.element = element;
    this.opening = opening;
    this.width = element.offsetWidth;
    this.height = element.offsetHeight;
  }

  // Update position relative to a reference element (world container)
  updatePosition(worldOrigin: DOMRect): void {
    const rect = this.element.getBoundingClientRect();
    this.worldX = rect.left - worldOrigin.left;
    this.worldY = rect.top - worldOrigin.top;
    this.width = rect.width;
    this.height = rect.height;
    this.rebuildWalls();
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
}
