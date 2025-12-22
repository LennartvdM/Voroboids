// Container - a region in world space with walls and a rendering viewport
// Containers don't "own" voroboids - they just define walls and render what's visible

import type { Vec2, Wall } from './types';
import { Voroboid } from './voroboid';
import { vec2 } from './math';

export type OpeningSide = 'top' | 'bottom' | 'left' | 'right';

export class Container {
  // Position in world space
  worldX: number;
  worldY: number;
  width: number;
  height: number;

  // Rendering
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  // Which side is open (no wall)
  opening: OpeningSide;

  // The actual wall segments (3 walls, gap on opening side)
  walls: Wall[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    opening: OpeningSide,
    worldX: number,
    worldY: number
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.opening = opening;
    this.worldX = worldX;
    this.worldY = worldY;
    this.width = canvas.width;
    this.height = canvas.height;

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

  // Update world position (e.g., after window resize/scroll)
  setWorldPosition(worldX: number, worldY: number): void {
    this.worldX = worldX;
    this.worldY = worldY;
    this.rebuildWalls();
  }

  // Rotate opening: right -> bottom -> left -> top -> right
  rotateOpening(): void {
    const sequence: OpeningSide[] = ['right', 'bottom', 'left', 'top'];
    const currentIndex = sequence.indexOf(this.opening);
    this.opening = sequence[(currentIndex + 1) % 4];
    this.rebuildWalls();
  }

  // Render container and any voroboids visible in this region
  render(voroboids: Voroboid[]): void {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw container background
    this.ctx.fillStyle = '#12121a';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw walls
    this.ctx.strokeStyle = '#4a4a6a';
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';

    this.ctx.beginPath();
    for (const wall of this.walls) {
      // Convert world coords to local canvas coords
      const startLocal = this.worldToLocal(wall.start);
      const endLocal = this.worldToLocal(wall.end);
      this.ctx.moveTo(startLocal.x, startLocal.y);
      this.ctx.lineTo(endLocal.x, endLocal.y);
    }
    this.ctx.stroke();

    // Render voroboids that are visible in this container's viewport
    for (const voroboid of voroboids) {
      if (this.isVisible(voroboid)) {
        this.renderVoroboid(voroboid);
      }
    }
  }

  // Check if a voroboid should be rendered in this container
  private isVisible(voroboid: Voroboid): boolean {
    const margin = voroboid.blobRadius * 2;
    return voroboid.position.x > this.worldX - margin &&
           voroboid.position.x < this.worldX + this.width + margin &&
           voroboid.position.y > this.worldY - margin &&
           voroboid.position.y < this.worldY + this.height + margin;
  }

  // Convert world position to local canvas position
  private worldToLocal(pos: Vec2): Vec2 {
    return vec2(pos.x - this.worldX, pos.y - this.worldY);
  }

  private renderVoroboid(voroboid: Voroboid): void {
    const shape = voroboid.getCurrentShape();
    if (shape.length < 3) return;

    // Convert shape to local coords
    const localShape = shape.map(p => this.worldToLocal(p));
    const localPos = this.worldToLocal(voroboid.position);

    this.ctx.beginPath();

    // Smooth blob rendering
    const first = localShape[0];
    const last = localShape[localShape.length - 1];
    this.ctx.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);

    for (let i = 0; i < localShape.length; i++) {
      const curr = localShape[i];
      const next = localShape[(i + 1) % localShape.length];
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;
      this.ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
    }

    this.ctx.closePath();

    // Gradient fill
    const gradient = this.ctx.createRadialGradient(
      localPos.x, localPos.y, 0,
      localPos.x, localPos.y, voroboid.blobRadius * 1.5
    );
    gradient.addColorStop(0, voroboid.color);
    gradient.addColorStop(1, this.darkenColor(voroboid.color, 0.3));

    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    // Subtle stroke
    this.ctx.strokeStyle = this.lightenColor(voroboid.color, 0.15);
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  private darkenColor(hex: string, factor: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.floor(r * (1 - factor))}, ${Math.floor(g * (1 - factor))}, ${Math.floor(b * (1 - factor))})`;
  }

  private lightenColor(hex: string, factor: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.min(255, Math.floor(r + (255 - r) * factor))}, ${Math.min(255, Math.floor(g + (255 - g) * factor))}, ${Math.min(255, Math.floor(b + (255 - b) * factor))})`;
  }

  // Get center of opening in world coords (useful for spawning attractors)
  getOpeningCenter(): Vec2 {
    switch (this.opening) {
      case 'top':
        return vec2(this.worldX + this.width / 2, this.worldY);
      case 'bottom':
        return vec2(this.worldX + this.width / 2, this.worldY + this.height);
      case 'left':
        return vec2(this.worldX, this.worldY + this.height / 2);
      case 'right':
        return vec2(this.worldX + this.width, this.worldY + this.height / 2);
    }
  }
}
