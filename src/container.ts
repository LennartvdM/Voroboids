// Container - holds voroboids in voronoi layout

import { Delaunay } from 'd3-delaunay';
import type { Vec2, ContainerBounds, BezierPath, FlockConfig } from './types';
import { Voroboid } from './voroboid';
import { vec2, gaussianRandom } from './math';

export class Container {
  bounds: ContainerBounds;
  voroboids: Voroboid[] = [];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  // Absolute position for cross-container calculations
  absoluteX: number;
  absoluteY: number;

  constructor(canvas: HTMLCanvasElement, absoluteX: number = 0, absoluteY: number = 0) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.absoluteX = absoluteX;
    this.absoluteY = absoluteY;
    this.bounds = {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
    };
  }

  // Add voroboids to this container
  setVoroboids(voroboids: Voroboid[]): void {
    this.voroboids = voroboids;
    this.computeVoronoi();
  }

  // Compute voronoi diagram and assign cells to voroboids
  computeVoronoi(): void {
    if (this.voroboids.length === 0) return;

    // Generate weighted points for voronoi
    // Use Lloyd relaxation for better distribution
    const points = this.generateWeightedPoints();

    // Compute Delaunay triangulation then Voronoi
    const delaunay = Delaunay.from(points);
    const voronoi = delaunay.voronoi([
      this.bounds.x,
      this.bounds.y,
      this.bounds.x + this.bounds.width,
      this.bounds.y + this.bounds.height,
    ]);

    // Assign cells to voroboids
    for (let i = 0; i < this.voroboids.length; i++) {
      const cellPolygon = voronoi.cellPolygon(i);
      if (cellPolygon) {
        const polygon: Vec2[] = cellPolygon.map((pt: [number, number]) => vec2(pt[0], pt[1]));
        const center = this.getPolygonCentroid(polygon);
        this.voroboids[i].setCell(polygon, center);
      }
    }
  }

  // Generate initial points with some weight influence
  private generateWeightedPoints(): [number, number][] {
    const points: [number, number][] = [];
    const padding = 20;

    // Start with random distribution
    for (let i = 0; i < this.voroboids.length; i++) {
      const x = padding + Math.random() * (this.bounds.width - padding * 2);
      const y = padding + Math.random() * (this.bounds.height - padding * 2);
      points.push([x, y]);
    }

    // Lloyd relaxation for more even distribution
    for (let iter = 0; iter < 10; iter++) {
      const delaunay = Delaunay.from(points);
      const voronoi = delaunay.voronoi([
        this.bounds.x,
        this.bounds.y,
        this.bounds.x + this.bounds.width,
        this.bounds.y + this.bounds.height,
      ]);

      for (let i = 0; i < points.length; i++) {
        const cell = voronoi.cellPolygon(i);
        if (cell) {
          const polygon: Vec2[] = cell.map((pt: [number, number]) => vec2(pt[0], pt[1]));
          const centroid = this.getPolygonCentroid(polygon);
          points[i] = [centroid.x, centroid.y];
        }
      }
    }

    return points;
  }

  // Calculate polygon centroid
  private getPolygonCentroid(polygon: Vec2[]): Vec2 {
    let cx = 0, cy = 0, area = 0;

    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      const cross = polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
      area += cross;
      cx += (polygon[i].x + polygon[j].x) * cross;
      cy += (polygon[i].y + polygon[j].y) * cross;
    }

    area /= 2;
    if (Math.abs(area) < 0.0001) {
      // Fallback to simple average for degenerate polygons
      const avgX = polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
      const avgY = polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;
      return vec2(avgX, avgY);
    }

    cx /= (6 * area);
    cy /= (6 * area);

    return vec2(cx, cy);
  }

  // Prepare migration to another container
  prepareMigration(
    targetContainer: Container,
    config: FlockConfig
  ): void {
    // Calculate migration path direction
    const sourceCenter = vec2(
      this.absoluteX + this.bounds.width / 2,
      this.absoluteY + this.bounds.height / 2
    );
    const targetCenter = vec2(
      targetContainer.absoluteX + targetContainer.bounds.width / 2,
      targetContainer.absoluteY + targetContainer.bounds.height / 2
    );

    // Compute target voronoi layout
    targetContainer.voroboids = this.voroboids;
    targetContainer.computeVoronoi();

    // Set up each voroboid for migration
    for (let i = 0; i < this.voroboids.length; i++) {
      const voroboid = this.voroboids[i];

      // Staggered launch delay (normal distribution)
      const delay = Math.max(0, gaussianRandom(config.staggerMean, config.staggerStdDev));

      // Create teh tarik bezier path
      const startPos = vec2(
        this.absoluteX + voroboid.position.x,
        this.absoluteY + voroboid.position.y
      );
      const endPos = vec2(
        targetContainer.absoluteX + voroboid.targetCenter.x,
        targetContainer.absoluteY + voroboid.targetCenter.y
      );

      const path = this.createTehTarikPath(startPos, endPos, sourceCenter, targetCenter);

      // Flight duration with some variance
      const duration = 1200 + Math.random() * 600;

      // Store target cell info
      voroboid.setTargetCell(voroboid.cellPolygon, voroboid.cellCenter);

      // Prepare for launch
      voroboid.prepareLaunch(delay, path, duration);
    }

    // Clear from this container (they're now in flight)
    this.voroboids = [];
  }

  // Create a teh tarik style arc path
  private createTehTarikPath(
    start: Vec2,
    end: Vec2,
    _sourceCenter: Vec2,
    _targetCenter: Vec2
  ): BezierPath {
    // Calculate the arc
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Arc height proportional to distance
    const arcHeight = dist * 0.6 + Math.random() * dist * 0.2;

    // Perpendicular direction for arc (with some randomness)
    const perpX = -dy / dist;
    const perpY = dx / dist;

    // Control points create the teh tarik arc
    // First control point: pull up and slightly forward
    const ctrl1 = vec2(
      start.x + dx * 0.25 + perpX * arcHeight * (0.8 + Math.random() * 0.4),
      start.y + dy * 0.25 + perpY * arcHeight * (0.8 + Math.random() * 0.4)
    );

    // Second control point: high arc, further along
    const ctrl2 = vec2(
      start.x + dx * 0.75 + perpX * arcHeight * (0.6 + Math.random() * 0.3),
      start.y + dy * 0.75 + perpY * arcHeight * (0.6 + Math.random() * 0.3)
    );

    return { start, control1: ctrl1, control2: ctrl2, end };
  }

  // Update all voroboids
  update(deltaTime: number, currentTime: number, config: FlockConfig): void {
    for (const voroboid of this.voroboids) {
      voroboid.update(deltaTime, currentTime, config, this.voroboids);
    }
  }

  // Render the container and its voroboids
  render(time: number): void {
    this.ctx.clearRect(0, 0, this.bounds.width, this.bounds.height);

    // Draw container background
    this.ctx.fillStyle = '#12121a';
    this.ctx.fillRect(0, 0, this.bounds.width, this.bounds.height);

    // Draw container border
    this.ctx.strokeStyle = '#2a2a3a';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(1, 1, this.bounds.width - 2, this.bounds.height - 2);

    // Render each voroboid
    for (const voroboid of this.voroboids) {
      this.renderVoroboid(voroboid, time);
    }
  }

  private renderVoroboid(voroboid: Voroboid, time: number): void {
    const shape = voroboid.getCurrentShape(time);
    if (shape.length < 3) return;

    this.ctx.beginPath();
    this.ctx.moveTo(shape[0].x, shape[0].y);

    if (voroboid.morphProgress > 0.5) {
      // Blob-like: use smooth curves
      for (let i = 0; i < shape.length; i++) {
        const next = shape[(i + 1) % shape.length];
        const nextNext = shape[(i + 2) % shape.length];

        const cpX = next.x;
        const cpY = next.y;
        const endX = (next.x + nextNext.x) / 2;
        const endY = (next.y + nextNext.y) / 2;

        this.ctx.quadraticCurveTo(cpX, cpY, endX, endY);
      }
    } else {
      // Voronoi-like: use straight edges with subtle rounding
      for (let i = 1; i < shape.length; i++) {
        this.ctx.lineTo(shape[i].x, shape[i].y);
      }
    }

    this.ctx.closePath();

    // Fill with gradient
    const gradient = this.ctx.createRadialGradient(
      voroboid.position.x, voroboid.position.y, 0,
      voroboid.position.x, voroboid.position.y, voroboid.blobRadius * 2
    );
    gradient.addColorStop(0, voroboid.color);
    gradient.addColorStop(1, this.darkenColor(voroboid.color, 0.3));

    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    // Subtle stroke
    this.ctx.strokeStyle = this.lightenColor(voroboid.color, 0.2);
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // Add subtle glow for blobs in flight
    if (voroboid.state === 'flying') {
      this.ctx.shadowColor = voroboid.color;
      this.ctx.shadowBlur = 15;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
    }
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

  // Check if all voroboids are settled
  isSettled(): boolean {
    return this.voroboids.every(v => v.state === 'contained');
  }
}
