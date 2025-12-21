// FlightRenderer - renders voroboids in flight between containers

import type { FlockConfig } from './types';
import { Voroboid } from './voroboid';

export class FlightRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private flyingVoroboids: Voroboid[] = [];

  constructor() {
    // Create overlay canvas for flight paths
    this.canvas = document.createElement('canvas');
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '1000';
    this.resize();

    this.ctx = this.canvas.getContext('2d')!;

    document.body.appendChild(this.canvas);

    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  // Track voroboids in flight
  setFlyingVoroboids(voroboids: Voroboid[]): void {
    this.flyingVoroboids = voroboids;
  }

  // Update flying voroboids
  update(deltaTime: number, currentTime: number, config: FlockConfig): void {
    for (const voroboid of this.flyingVoroboids) {
      if (voroboid.state === 'launching' || voroboid.state === 'flying') {
        voroboid.update(deltaTime, currentTime, config, this.flyingVoroboids);
      }
    }
  }

  // Render all flying voroboids
  render(time: number): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const voroboid of this.flyingVoroboids) {
      if (voroboid.state === 'launching' || voroboid.state === 'flying') {
        this.renderVoroboid(voroboid, time);
      }
    }
  }

  private renderVoroboid(voroboid: Voroboid, time: number): void {
    const shape = voroboid.getCurrentShape(time);
    if (shape.length < 3) return;

    this.ctx.beginPath();

    // Use smooth bezier curves for blob shapes
    const firstMid = {
      x: (shape[shape.length - 1].x + shape[0].x) / 2,
      y: (shape[shape.length - 1].y + shape[0].y) / 2,
    };
    this.ctx.moveTo(firstMid.x, firstMid.y);

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
    gradient.addColorStop(0.7, voroboid.color);
    gradient.addColorStop(1, this.adjustAlpha(voroboid.color, 0.6));

    this.ctx.fillStyle = gradient;

    // Glow effect
    this.ctx.shadowColor = voroboid.color;
    this.ctx.shadowBlur = 20;
    this.ctx.fill();

    // Subtle inner glow
    this.ctx.shadowBlur = 8;
    this.ctx.fill();

    this.ctx.shadowBlur = 0;

    // Trail effect for fast-moving blobs
    if (voroboid.state === 'flying') {
      this.renderTrail(voroboid, time);
    }
  }

  private renderTrail(voroboid: Voroboid, _time: number): void {
    // Simple motion blur trail
    const trailLength = 3;
    const vel = voroboid.velocity;

    for (let i = 1; i <= trailLength; i++) {
      const alpha = 0.15 * (1 - i / trailLength);
      const offsetX = -vel.x * i * 0.5;
      const offsetY = -vel.y * i * 0.5;
      const scale = 1 - i * 0.1;

      this.ctx.beginPath();
      this.ctx.arc(
        voroboid.position.x + offsetX,
        voroboid.position.y + offsetY,
        voroboid.blobRadius * scale,
        0,
        Math.PI * 2
      );
      this.ctx.fillStyle = this.adjustAlpha(voroboid.color, alpha);
      this.ctx.fill();
    }
  }

  private adjustAlpha(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Check if all flying voroboids have arrived
  allArrived(): boolean {
    return this.flyingVoroboids.every(
      v => v.state === 'arriving' || v.state === 'settling' || v.state === 'contained'
    );
  }

  // Transfer voroboids to target container when they start arriving
  getArrivedVoroboids(): Voroboid[] {
    return this.flyingVoroboids.filter(
      v => v.state === 'arriving' || v.state === 'settling'
    );
  }

  // Clear flying voroboids
  clear(): void {
    this.flyingVoroboids = [];
  }
}
