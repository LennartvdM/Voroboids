// Container - holds voroboids in voronoi layout with one open side

import { Delaunay } from 'd3-delaunay';
import type { Vec2, ContainerBounds, BezierPath, FlockConfig, OpeningSide } from './types';
import { getOpeningEdge, getOpeningDirection } from './types';
import { Voroboid } from './voroboid';
import { vec2, gaussianRandom } from './math';

export class Container {
  bounds: ContainerBounds;
  voroboids: Voroboid[] = [];
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  // Which side is open (the "pour spout")
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

  // Add voroboids to this container
  setVoroboids(voroboids: Voroboid[]): void {
    this.voroboids = voroboids;
    this.computeVoronoi();
  }

  // Compute voronoi diagram and assign cells to voroboids
  computeVoronoi(): void {
    if (this.voroboids.length === 0) return;

    // Generate weighted points for voronoi
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

  // Generate initial points with Lloyd relaxation
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
      const avgX = polygon.reduce((sum, p) => sum + p.x, 0) / polygon.length;
      const avgY = polygon.reduce((sum, p) => sum + p.y, 0) / polygon.length;
      return vec2(avgX, avgY);
    }

    cx /= (6 * area);
    cy /= (6 * area);

    return vec2(cx, cy);
  }

  // Get the opening edge in absolute coordinates
  getAbsoluteOpeningEdge(): { start: Vec2; end: Vec2 } {
    const localEdge = getOpeningEdge(this.bounds, this.opening);
    return {
      start: { x: this.absoluteX + localEdge.start.x, y: this.absoluteY + localEdge.start.y },
      end: { x: this.absoluteX + localEdge.end.x, y: this.absoluteY + localEdge.end.y },
    };
  }

  // Prepare migration to another container
  prepareMigration(targetContainer: Container, config: FlockConfig): void {
    // Get opening edges
    const sourceEdge = this.getAbsoluteOpeningEdge();
    const targetEdge = targetContainer.getAbsoluteOpeningEdge();

    // Get opening directions (outward normals)
    const sourceDir = getOpeningDirection(this.opening);
    const targetDir = getOpeningDirection(targetContainer.opening);

    // Compute target voronoi layout
    targetContainer.voroboids = this.voroboids;
    targetContainer.computeVoronoi();

    // Sort voroboids by their position along the opening edge
    // This creates natural lanes
    const sortedVoroboids = [...this.voroboids].sort((a, b) => {
      if (this.opening === 'left' || this.opening === 'right') {
        return a.position.y - b.position.y; // Sort by Y for vertical openings
      } else {
        return a.position.x - b.position.x; // Sort by X for horizontal openings
      }
    });

    // Assign each voroboid a "lane" position (0-1) along the opening
    const numVoroboids = sortedVoroboids.length;

    for (let i = 0; i < numVoroboids; i++) {
      const voroboid = sortedVoroboids[i];

      // Lane position (0 to 1) with padding from edges
      const laneT = (i + 0.5) / numVoroboids;

      // Calculate exit point along source opening
      const exitPoint: Vec2 = {
        x: sourceEdge.start.x + (sourceEdge.end.x - sourceEdge.start.x) * laneT,
        y: sourceEdge.start.y + (sourceEdge.end.y - sourceEdge.start.y) * laneT,
      };

      // Calculate entry point along target opening
      const entryPoint: Vec2 = {
        x: targetEdge.start.x + (targetEdge.end.x - targetEdge.start.x) * laneT,
        y: targetEdge.start.y + (targetEdge.end.y - targetEdge.start.y) * laneT,
      };

      // Create bezier path from voroboid's current position through exit to entry
      const startPos = vec2(
        this.absoluteX + voroboid.position.x,
        this.absoluteY + voroboid.position.y
      );

      const path = this.createFlowPath(startPos, exitPoint, entryPoint, sourceDir, targetDir);

      // Staggered launch delay based on distance from opening
      // Voroboids closer to the opening leave first
      const distanceToOpening = this.getDistanceToOpening(voroboid.position);
      const maxDist = Math.max(this.bounds.width, this.bounds.height);
      const normalizedDist = distanceToOpening / maxDist;

      // Base delay + distance-based stagger + small random variance
      const delay = normalizedDist * config.staggerMean + gaussianRandom(0, config.staggerStdDev * 0.3);

      // Flight duration with slight variance per lane
      const duration = 800 + Math.random() * 400;

      // Store target cell info
      voroboid.setTargetCell(voroboid.cellPolygon, voroboid.cellCenter);

      // Prepare for launch
      voroboid.prepareLaunch(Math.max(0, delay), path, duration);
    }

    // Clear from this container
    this.voroboids = [];
  }

  // Get distance from a point to the opening edge
  private getDistanceToOpening(pos: Vec2): number {
    switch (this.opening) {
      case 'top': return pos.y;
      case 'bottom': return this.bounds.height - pos.y;
      case 'left': return pos.x;
      case 'right': return this.bounds.width - pos.x;
    }
  }

  // Create a flow path that respects the openings
  private createFlowPath(
    start: Vec2,
    exitPoint: Vec2,
    entryPoint: Vec2,
    sourceDir: Vec2,
    targetDir: Vec2
  ): BezierPath {
    // Distance between exit and entry
    const dx = entryPoint.x - exitPoint.x;
    const dy = entryPoint.y - exitPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Control point distance - creates the arc
    const arcStrength = distance * 0.4;

    // First control point: extends outward from source opening
    const ctrl1: Vec2 = {
      x: exitPoint.x + sourceDir.x * arcStrength,
      y: exitPoint.y + sourceDir.y * arcStrength,
    };

    // Second control point: extends outward from target opening (inward from entry direction)
    const ctrl2: Vec2 = {
      x: entryPoint.x - targetDir.x * arcStrength,
      y: entryPoint.y - targetDir.y * arcStrength,
    };

    return {
      start: start,
      control1: ctrl1,
      control2: ctrl2,
      end: entryPoint,
    };
  }

  // Update all voroboids
  update(deltaTime: number, currentTime: number, config: FlockConfig): void {
    for (const voroboid of this.voroboids) {
      voroboid.update(deltaTime, currentTime, config, this.voroboids);
    }
  }

  // Render the container with 3 walls (opening is missing)
  render(time: number): void {
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
      // Voronoi-like: straight edges
      for (let i = 1; i < shape.length; i++) {
        this.ctx.lineTo(shape[i].x, shape[i].y);
      }
    }
    this.ctx.closePath();

    // Gradient fill
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
