// VoroboidsSystem - unified world with global rendering
// All voroboids exist in world space, rendered on a single canvas

import type { Vec2, VoroboidConfig, FlockConfig, Wall, MagnetConfig, WallPolarity } from './types';
import { DEFAULT_FLOCK_CONFIG } from './types';
import { Voroboid, TargetContainerInfo } from './voroboid';
import { Container } from './container';
import { vec2, add, sub, mul, magnitude, normalize, insetPolygon } from './math';

export class VoroboidsSystem {
  private containers: Map<string, Container> = new Map();
  private voroboids: Voroboid[] = [];
  private config: FlockConfig;

  // World rendering
  private worldCanvas: HTMLCanvasElement;
  private worldContainer: HTMLElement;
  private ctx: CanvasRenderingContext2D;

  private lastTime: number = 0;
  private animationId: number | null = null;

  // Active magnet container - which bucket's magnet is currently "on"
  // Both buckets have magnets, but only one is active at a time
  private activeMagnetContainer: string = 'a';

  // Debug visualization
  debug: boolean = true;

  constructor(
    worldCanvas: HTMLCanvasElement,
    worldContainer: HTMLElement,
    config: Partial<FlockConfig> = {}
  ) {
    this.worldCanvas = worldCanvas;
    this.worldContainer = worldContainer;
    this.ctx = worldCanvas.getContext('2d')!;
    this.config = { ...DEFAULT_FLOCK_CONFIG, ...config };

    this.updateCanvasSize();
  }

  // Update canvas to match world container size
  updateCanvasSize(): void {
    const rect = this.worldContainer.getBoundingClientRect();
    // Add bleed zone around the demo area
    const bleed = 100;
    this.worldCanvas.width = rect.width + bleed * 2;
    this.worldCanvas.height = rect.height + bleed * 2;
    this.worldCanvas.style.left = `-${bleed}px`;
    this.worldCanvas.style.top = `-${bleed}px`;
  }

  // Register a container (Maxwell's Demon region with 4 walls)
  registerContainer(id: string, element: HTMLElement, initialPolarity: WallPolarity = 'inward'): Container {
    const container = new Container(element);
    container.setPolarity(initialPolarity);
    this.containers.set(id, container);
    this.updateContainerPositions();
    return container;
  }

  // Create voroboids and spawn them in a container region
  initializeVoroboids(containerId: string, configs: VoroboidConfig[]): void {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    // Clear existing voroboids
    this.voroboids = [];

    const bounds = container.getBounds();
    const padding = 40;

    // Set this container as active and target for all voroboids
    this.activeMagnetContainer = containerId;

    for (const cfg of configs) {
      const voroboid = new Voroboid(cfg);
      voroboid.blobRadius = this.config.blobRadius;

      // Position in world space within the container
      voroboid.position = vec2(
        bounds.x + padding + Math.random() * (bounds.width - padding * 2),
        bounds.y + padding + Math.random() * (bounds.height - padding * 2)
      );

      // Give initial random velocity - they start moving!
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      voroboid.velocity = vec2(Math.cos(angle) * speed, Math.sin(angle) * speed);

      // Set initial target container
      voroboid.targetContainerId = containerId;
      voroboid.isSettled = false;

      this.voroboids.push(voroboid);
    }
  }

  // Collect all walls from all containers
  private getAllWalls(): Wall[] {
    const walls: Wall[] = [];
    for (const container of this.containers.values()) {
      walls.push(...container.walls);
    }
    return walls;
  }

  // Start animation loop
  start(): void {
    this.lastTime = performance.now();
    this.loop();
  }

  // Stop animation loop
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private loop = (): void => {
    const currentTime = performance.now();
    const deltaTime = Math.min(currentTime - this.lastTime, 32);
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();

    this.animationId = requestAnimationFrame(this.loop);
  };

  private update(deltaTime: number): void {
    const allWalls = this.getAllWalls();

    for (const voroboid of this.voroboids) {
      // Get target container info for intent-based navigation
      const targetInfo = this.getTargetContainerInfo(voroboid);
      const magnet = this.getMagnetForVoroboid(voroboid);
      voroboid.update(deltaTime, this.voroboids, allWalls, this.config, magnet, targetInfo);
    }

    // Simple collision resolution - voroboids respect each other's space
    Voroboid.resolveCollisions(this.voroboids);

    // Compute polygons for tessellation
    this.computePolygons();
  }

  // Get target container info for a voroboid's navigation
  private getTargetContainerInfo(voroboid: Voroboid): TargetContainerInfo | undefined {
    const targetContainer = this.containers.get(voroboid.targetContainerId);
    if (!targetContainer) return undefined;

    const bounds = targetContainer.getBounds();
    const center = targetContainer.getCenter();

    return {
      bounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      },
      center
    };
  }

  // Compute Voronoi-like polygons for all voroboids
  // Each voroboid clips against walls and neighbors, starting from its container bounds
  private computePolygons(): void {
    const allWalls = this.getAllWalls();

    for (const voroboid of this.voroboids) {
      // Get the container bounds for this voroboid
      const container = this.containers.get(voroboid.targetContainerId);
      const containerBounds = container ? container.getBounds() : undefined;

      voroboid.computePolygon(this.voroboids, allWalls, containerBounds);
    }
  }

  // Get the magnet configuration for a voroboid based on its position
  // With Maxwell's Demon walls, voroboids are always pulled toward target container center
  private getMagnetForVoroboid(voroboid: Voroboid): MagnetConfig | undefined {
    const targetContainer = this.containers.get(voroboid.targetContainerId);
    if (!targetContainer) return undefined;

    // Always attract toward the target container's center
    // The walls will handle whether the voroboid can enter/exit
    return targetContainer.getMagnet();
  }

  private render(): void {
    const bleed = 100;
    const width = this.worldCanvas.width;
    const height = this.worldCanvas.height;

    // Clear canvas
    this.ctx.clearRect(0, 0, width, height);

    // DEBUG: Draw canvas bounds (before translate)
    if (this.debug) {
      // Full canvas area - RED border
      this.ctx.strokeStyle = '#ff0000';
      this.ctx.lineWidth = 4;
      this.ctx.strokeRect(2, 2, width - 4, height - 4);

      // Label
      this.ctx.fillStyle = '#ff0000';
      this.ctx.font = '14px monospace';
      this.ctx.fillText(`CANVAS: ${width}x${height}`, 10, 20);
    }

    // Offset for bleed zone
    this.ctx.save();
    this.ctx.translate(bleed, bleed);

    // DEBUG: Draw world container area (after translate) - GREEN
    if (this.debug) {
      const worldRect = this.worldContainer.getBoundingClientRect();
      this.ctx.strokeStyle = '#00ff00';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(0, 0, worldRect.width, worldRect.height);

      this.ctx.fillStyle = '#00ff00';
      this.ctx.font = '12px monospace';
      this.ctx.fillText(`WORLD: ${Math.round(worldRect.width)}x${Math.round(worldRect.height)}`, 10, -10);
    }

    // Render container backgrounds
    for (const container of this.containers.values()) {
      this.renderContainerBackground(container);
    }

    // DEBUG: Draw container bounds and magnets
    if (this.debug) {
      for (const [id, container] of this.containers.entries()) {
        const bounds = container.getBounds();

        // Container bounds - CYAN
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);

        // Label
        this.ctx.fillStyle = '#00ffff';
        this.ctx.font = '11px monospace';
        this.ctx.fillText(`${id}: (${Math.round(bounds.x)},${Math.round(bounds.y)})`, bounds.x + 5, bounds.y + 15);

        // Magnet position - YELLOW if active, GRAY if inactive
        const magnet = container.getMagnet();
        const isActive = id === this.activeMagnetContainer;
        this.ctx.fillStyle = isActive ? '#ffff00' : '#666666';
        this.ctx.beginPath();
        this.ctx.arc(magnet.position.x, magnet.position.y, isActive ? 10 : 6, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = isActive ? '#000' : '#999';
        this.ctx.font = isActive ? 'bold 12px monospace' : '10px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(isActive ? 'ON' : 'M', magnet.position.x, magnet.position.y + 4);
        this.ctx.textAlign = 'left';
      }
    }

    // Render all voroboids
    for (const voroboid of this.voroboids) {
      this.renderVoroboid(voroboid);

      // DEBUG: Draw voroboid position, velocity, weight, and pressure
      if (this.debug) {
        // Position - small magenta dot
        this.ctx.fillStyle = '#ff00ff';
        this.ctx.beginPath();
        this.ctx.arc(voroboid.position.x, voroboid.position.y, 4, 0, Math.PI * 2);
        this.ctx.fill();

        // Velocity vector - magenta line
        this.ctx.strokeStyle = '#ff00ff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(voroboid.position.x, voroboid.position.y);
        this.ctx.lineTo(
          voroboid.position.x + voroboid.velocity.x * 10,
          voroboid.position.y + voroboid.velocity.y * 10
        );
        this.ctx.stroke();

        // Weight and Pressure labels - show the bottom-up negotiation state
        this.ctx.font = 'bold 11px monospace';
        this.ctx.textAlign = 'center';

        // Weight label (w:) - the cell's claim on space
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(
          `w:${voroboid.weight.toFixed(1)}`,
          voroboid.position.x,
          voroboid.position.y - 12
        );

        // Pressure label (p:) - compression feedback
        // Color-coded: green = relaxed, yellow = normal, red = compressed
        const pressure = voroboid.pressure;
        let pressureColor = '#88ff88'; // green - relaxed
        if (pressure > 1.2) pressureColor = '#ff8888'; // red - compressed
        else if (pressure > 0.8) pressureColor = '#ffff88'; // yellow - normal

        this.ctx.fillStyle = pressureColor;
        this.ctx.fillText(
          `p:${pressure.toFixed(2)}`,
          voroboid.position.x,
          voroboid.position.y + 18
        );

        this.ctx.textAlign = 'left';
      }
    }

    // Render container walls on top
    for (const container of this.containers.values()) {
      this.renderContainerWalls(container);
    }

    this.ctx.restore();
  }

  private renderContainerBackground(container: Container): void {
    this.ctx.fillStyle = '#12121a';
    this.ctx.beginPath();
    this.ctx.roundRect(
      container.worldX,
      container.worldY,
      container.width,
      container.height,
      8
    );
    this.ctx.fill();
  }

  // Render walls with polarity-based visual styles
  // inward: solid warm purple (trapping)
  // outward: dashed cool teal (releasing)
  // solid: thick dark line
  // permeable: thin dotted
  private renderContainerWalls(container: Container): void {
    this.ctx.lineCap = 'round';

    for (const wall of container.walls) {
      this.ctx.beginPath();
      this.ctx.moveTo(wall.start.x, wall.start.y);
      this.ctx.lineTo(wall.end.x, wall.end.y);

      switch (wall.polarity) {
        case 'inward':
          // Warm purple - trapping, cells can enter but not leave
          this.ctx.strokeStyle = '#9b59b6';
          this.ctx.lineWidth = 4;
          this.ctx.setLineDash([]);
          break;
        case 'outward':
          // Cool teal - releasing, cells can leave but not enter
          this.ctx.strokeStyle = '#1abc9c';
          this.ctx.lineWidth = 3;
          this.ctx.setLineDash([8, 4]);
          break;
        case 'solid':
          // Dark thick - blocks all passage
          this.ctx.strokeStyle = '#2c3e50';
          this.ctx.lineWidth = 5;
          this.ctx.setLineDash([]);
          break;
        case 'permeable':
          // Thin dotted - allows all passage
          this.ctx.strokeStyle = '#7f8c8d';
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([2, 4]);
          break;
      }

      this.ctx.stroke();
    }

    // Reset line dash
    this.ctx.setLineDash([]);
  }

  private renderVoroboid(voroboid: Voroboid): void {
    // Use polygon tessellation if available, otherwise fall back to blob
    const polygon = voroboid.polygon;
    if (polygon.length >= 3) {
      this.renderPolygon(voroboid, polygon);
    } else {
      this.renderBlob(voroboid);
    }
  }

  // Render Voronoi-like polygon cell
  private renderPolygon(voroboid: Voroboid, polygon: Vec2[]): void {
    // Inset polygon for gap between cells
    const gap = 2;
    const inset = insetPolygon(polygon, gap);
    if (inset.length < 3) return;

    // Get bounds for content rendering
    const bounds = this.getPolygonBounds(inset);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    const radius = Math.max(bounds.width, bounds.height) / 2;

    // Draw rounded polygon path (for clipping)
    this.drawRoundedPolygon(inset, 6);

    // Check if voroboid has content
    if (voroboid.content) {
      this.renderContent(voroboid, inset, bounds);
    } else {
      // Default gradient fill
      const gradient = this.ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, radius
      );
      gradient.addColorStop(0, voroboid.color);
      gradient.addColorStop(1, this.darkenColor(voroboid.color, 0.25));

      this.ctx.fillStyle = gradient;
      this.ctx.fill();
    }

    // Subtle stroke
    this.ctx.strokeStyle = this.lightenColor(voroboid.color, 0.1);
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  // Render content clipped to polygon
  private renderContent(
    voroboid: Voroboid,
    _polygon: Vec2[],
    bounds: { x: number; y: number; width: number; height: number }
  ): void {
    const content = voroboid.content;
    if (!content) return;

    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    switch (content.type) {
      case 'color':
        this.ctx.fillStyle = content.color;
        this.ctx.fill();
        break;

      case 'gradient':
        if (content.colors.length >= 2) {
          const gradient = this.ctx.createLinearGradient(
            bounds.x, bounds.y,
            bounds.x + bounds.width, bounds.y + bounds.height
          );
          content.colors.forEach((color, i) => {
            gradient.addColorStop(i / (content.colors.length - 1), color);
          });
          this.ctx.fillStyle = gradient;
        } else if (content.colors.length === 1) {
          this.ctx.fillStyle = content.colors[0];
        }
        this.ctx.fill();
        break;

      case 'image':
        if (voroboid.imageLoaded && voroboid.contentImage) {
          // Save context for clipping
          this.ctx.save();
          this.ctx.clip();

          // Calculate image dimensions to cover the polygon (cover, not contain)
          const img = voroboid.contentImage;
          const imgAspect = img.width / img.height;
          const boundsAspect = bounds.width / bounds.height;

          let drawWidth: number, drawHeight: number, drawX: number, drawY: number;

          if (imgAspect > boundsAspect) {
            // Image is wider - fit height, crop width
            drawHeight = bounds.height;
            drawWidth = drawHeight * imgAspect;
            drawX = bounds.x - (drawWidth - bounds.width) / 2;
            drawY = bounds.y;
          } else {
            // Image is taller - fit width, crop height
            drawWidth = bounds.width;
            drawHeight = drawWidth / imgAspect;
            drawX = bounds.x;
            drawY = bounds.y - (drawHeight - bounds.height) / 2;
          }

          this.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
          this.ctx.restore();
        } else {
          // Image not loaded yet - show placeholder
          this.ctx.fillStyle = voroboid.color;
          this.ctx.fill();
        }
        break;

      case 'text':
        // Fill background first
        this.ctx.fillStyle = voroboid.color;
        this.ctx.fill();

        // Render text
        this.ctx.save();
        this.ctx.clip();

        const fontSize = content.fontSize || Math.min(bounds.width, bounds.height) * 0.3;
        const fontColor = content.fontColor || '#ffffff';

        this.ctx.font = `bold ${fontSize}px sans-serif`;
        this.ctx.fillStyle = fontColor;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(content.text, centerX, centerY, bounds.width * 0.9);

        this.ctx.restore();
        break;
    }
  }

  // Draw polygon with rounded corners
  private drawRoundedPolygon(polygon: Vec2[], cornerRadius: number): void {
    if (polygon.length < 3) return;

    this.ctx.beginPath();

    for (let i = 0; i < polygon.length; i++) {
      const prev = polygon[(i - 1 + polygon.length) % polygon.length];
      const curr = polygon[i];
      const next = polygon[(i + 1) % polygon.length];

      // Vectors to adjacent vertices
      const toPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
      const toNext = { x: next.x - curr.x, y: next.y - curr.y };

      // Distances
      const distPrev = Math.sqrt(toPrev.x * toPrev.x + toPrev.y * toPrev.y);
      const distNext = Math.sqrt(toNext.x * toNext.x + toNext.y * toNext.y);

      // Limit corner radius to half the shorter edge
      const maxRadius = Math.min(distPrev, distNext) / 2;
      const radius = Math.min(cornerRadius, maxRadius);

      // Points where the arc starts and ends
      const startX = curr.x + (toPrev.x / distPrev) * radius;
      const startY = curr.y + (toPrev.y / distPrev) * radius;
      const endX = curr.x + (toNext.x / distNext) * radius;
      const endY = curr.y + (toNext.y / distNext) * radius;

      if (i === 0) {
        this.ctx.moveTo(startX, startY);
      } else {
        this.ctx.lineTo(startX, startY);
      }

      this.ctx.quadraticCurveTo(curr.x, curr.y, endX, endY);
    }

    this.ctx.closePath();
  }

  // Get bounding box of polygon
  private getPolygonBounds(polygon: Vec2[]): { x: number; y: number; width: number; height: number } {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const p of polygon) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  // Legacy blob rendering (fallback)
  private renderBlob(voroboid: Voroboid): void {
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
    return `rgb(${Math.min(255, Math.floor(r + (255 - r) * factor))}, ${Math.min(255, Math.floor(g + (255 - g) * factor))}, ${Math.min(255, Math.floor(b + (255 - b) * factor))})`;
  }

  // Update container positions (call on resize/scroll)
  updateContainerPositions(): void {
    const worldRect = this.worldContainer.getBoundingClientRect();
    for (const container of this.containers.values()) {
      container.updatePosition(worldRect);
    }
    this.updateCanvasSize();
  }

  // Pour all voroboids to a target container - Maxwell's Demon style!
  // Source container: flip to outward (cells can escape)
  // Target container: flip to inward (cells get trapped)
  pourTo(targetId: string): void {
    const targetContainer = this.containers.get(targetId);
    if (!targetContainer) return;

    // Find the source container (the other one)
    const sourceId = targetId === 'a' ? 'b' : 'a';
    const sourceContainer = this.containers.get(sourceId);

    // Flip polarities - the magic of Maxwell's Demon
    if (sourceContainer) {
      sourceContainer.setPolarity('outward');  // Release!
    }
    targetContainer.setPolarity('inward');     // Trap!

    this.activeMagnetContainer = targetId;
    const center = targetContainer.getCenter();

    for (const voroboid of this.voroboids) {
      const dist = magnitude(sub(voroboid.position, center));
      voroboid.setTargetContainer(targetId, dist);

      // Give a kick toward the target center
      const toCenter = sub(center, voroboid.position);
      const kickDir = magnitude(toCenter) > 1 ? normalize(toCenter) : vec2(0, 0);
      voroboid.velocity = add(voroboid.velocity, mul(kickDir, 3));
    }
  }

  // Set all containers to solid (no passage) - initial stable state
  solidifyAll(): void {
    for (const container of this.containers.values()) {
      container.setPolarity('solid');
    }
  }

  // Get which container's magnet is currently active
  getActiveMagnetContainer(): string {
    return this.activeMagnetContainer;
  }

  // Get voroboids
  getVoroboids(): Voroboid[] {
    return this.voroboids;
  }

  // Get a container by ID
  getContainer(id: string): Container | undefined {
    return this.containers.get(id);
  }

  // Toggle debug visualization
  toggleDebug(): boolean {
    this.debug = !this.debug;
    return this.debug;
  }
}

// Generate color palette
export function generateColors(count: number): string[] {
  const colors: string[] = [];
  const baseHues = [340, 280, 200, 160, 40, 20];

  for (let i = 0; i < count; i++) {
    const hue = baseHues[i % baseHues.length] + (Math.random() - 0.5) * 20;
    const sat = 60 + Math.random() * 20;
    const light = 50 + Math.random() * 15;
    colors.push(hslToHex(hue, sat, light));
  }

  return colors;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
