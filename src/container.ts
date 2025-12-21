// Container - manages a flock of voroboids
// No longer computes voronoi - structure emerges from agent behaviors

import type { ContainerBounds, FlockConfig, OpeningSide } from './types';
import { Voroboid } from './voroboid';
import { vec2 } from './math';

export class Container {
  bounds: ContainerBounds;
  voroboids: Voroboid[] = [];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  // Which side is open
  opening: OpeningSide;

  // Absolute position for cross-container calculations
  absoluteX: number;
  absoluteY: number;

  constructor(canvas: HTMLCanvasElement, opening: OpeningSide, absoluteX: number = 0, absoluteY: number = 0) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.opening = opening;
    this.absoluteX = absoluteX;
    this.absoluteY = absoluteY;
    this.bounds = {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
    };
  }

  // Add voroboids - scatter them and let them find equilibrium
  setVoroboids(voroboids: Voroboid[]): void {
    this.voroboids = voroboids;

    // Scatter voroboids randomly within bounds
    const padding = 40;
    for (const v of this.voroboids) {
      v.position = vec2(
        padding + Math.random() * (this.bounds.width - padding * 2),
        padding + Math.random() * (this.bounds.height - padding * 2)
      );
      v.velocity = vec2(0, 0);
      v.setContainer(this.bounds, this.opening);
      v.mode = 'settled';
    }
  }

  // Trigger migration to another container
  startMigration(targetContainer: Container): void {
    // Calculate the offset between containers (for absolute positioning during flight)
    const absoluteOffset = vec2(
      targetContainer.absoluteX - this.absoluteX,
      targetContainer.absoluteY - this.absoluteY
    );

    // Tell each voroboid to start migrating
    for (const v of this.voroboids) {
      v.startMigration(targetContainer.bounds, targetContainer.opening, absoluteOffset);
    }

    // Transfer voroboids to target (they'll handle their own navigation)
    targetContainer.voroboids = this.voroboids;
    this.voroboids = [];
  }

  // Update all voroboids
  update(deltaTime: number, config: FlockConfig): void {
    // All voroboids see all others in the container for boid behaviors
    for (const voroboid of this.voroboids) {
      voroboid.update(deltaTime, this.voroboids, config);
    }
  }

  // Render the container with 3 walls
  render(): void {
    this.ctx.clearRect(0, 0, this.bounds.width, this.bounds.height);

    // Draw container background
    this.ctx.fillStyle = '#12121a';
    this.ctx.fillRect(0, 0, this.bounds.width, this.bounds.height);

    // Draw 3 walls (not the opening side)
    this.ctx.strokeStyle = '#4a4a6a';
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';

    const w = this.bounds.width;
    const h = this.bounds.height;

    this.ctx.beginPath();

    if (this.opening !== 'top') {
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(w, 0);
    }
    if (this.opening !== 'right') {
      this.ctx.moveTo(w, 0);
      this.ctx.lineTo(w, h);
    }
    if (this.opening !== 'bottom') {
      this.ctx.moveTo(w, h);
      this.ctx.lineTo(0, h);
    }
    if (this.opening !== 'left') {
      this.ctx.moveTo(0, h);
      this.ctx.lineTo(0, 0);
    }

    this.ctx.stroke();

    // Render each voroboid
    for (const voroboid of this.voroboids) {
      this.renderVoroboid(voroboid);
    }
  }

  private renderVoroboid(voroboid: Voroboid): void {
    const shape = voroboid.getCurrentShape();
    if (shape.length < 3) return;

    this.ctx.beginPath();

    // Smooth blob rendering
    const first = shape[0];
    const last = shape[shape.length - 1];
    this.ctx.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);

    for (let i = 0; i < shape.length; i++) {
      const curr = shape[i];
      const next = shape[(i + 1) % shape.length];
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;
      this.ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
    }

    this.ctx.closePath();

    // Gradient fill
    const gradient = this.ctx.createRadialGradient(
      voroboid.position.x, voroboid.position.y, 0,
      voroboid.position.x, voroboid.position.y, voroboid.blobRadius * 1.5
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
    return `rgb(${Math.min(255, Math.floor(r + (255 - r) * factor))}, ${Math.min(255, Math.floor(g + (255 - g) * factor))}, ${Math.min(255, Math.floor(b + (255 - g) * factor))})`;
  }

  // Check if all voroboids are settled
  isSettled(): boolean {
    return this.voroboids.every(v => v.mode === 'settled');
  }
}
