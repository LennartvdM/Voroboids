// VoroboidsSystem - unified world with global rendering
// All voroboids exist in world space, rendered on a single canvas

import type { Vec2, VoroboidConfig, FlockConfig, Wall, MagnetConfig } from './types';
import { DEFAULT_FLOCK_CONFIG } from './types';
import { Voroboid } from './voroboid';
import { Container, OpeningSide } from './container';
import { vec2, insetPolygon } from './math';

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

  // Register a container (region with walls)
  registerContainer(id: string, element: HTMLElement, opening: OpeningSide): Container {
    const container = new Container(element, opening);
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

    for (const cfg of configs) {
      const voroboid = new Voroboid(cfg);
      voroboid.blobRadius = this.config.blobRadius;

      // Position in world space within the container
      voroboid.position = vec2(
        bounds.x + padding + Math.random() * (bounds.width - padding * 2),
        bounds.y + padding + Math.random() * (bounds.height - padding * 2)
      );

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
      // Find which container this voroboid is in and get its magnet
      const magnet = this.getMagnetForVoroboid(voroboid);
      voroboid.update(deltaTime, this.voroboids, allWalls, this.config, magnet);
    }

    // Compute polygons for tessellation
    this.computePolygons();
  }

  // Compute Voronoi-like polygons for all voroboids
  // Cells clip against walls and neighbors - no container bounds needed
  private computePolygons(): void {
    const allWalls = this.getAllWalls();

    for (const voroboid of this.voroboids) {
      voroboid.computePolygon(this.voroboids, allWalls);
    }
  }

  // Find which container a voroboid is in
  private getContainerForVoroboid(voroboid: Voroboid): Container | undefined {
    for (const container of this.containers.values()) {
      if (container.containsPoint(voroboid.position)) {
        return container;
      }
    }
    // Return nearest container if not inside any
    let nearestContainer: Container | undefined;
    let minDist = Infinity;

    for (const container of this.containers.values()) {
      const bounds = container.getBounds();
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      const dx = voroboid.position.x - centerX;
      const dy = voroboid.position.y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < minDist) {
        minDist = dist;
        nearestContainer = container;
      }
    }

    return nearestContainer;
  }

  // Get the magnet configuration for a voroboid based on its position
  // Voroboids inside their own container are pulled toward the active magnet
  // Voroboids in a different container are guided toward that container's opening first
  private getMagnetForVoroboid(voroboid: Voroboid): MagnetConfig | undefined {
    const activeContainer = this.containers.get(this.activeMagnetContainer);
    if (!activeContainer) return undefined;

    // Find which container this voroboid is currently in
    const currentContainer = this.getContainerForVoroboid(voroboid);

    // If voroboid is in the active container, attract toward the magnet
    if (currentContainer && this.getContainerIdFor(currentContainer) === this.activeMagnetContainer) {
      return activeContainer.getMagnet();
    }

    // If voroboid is in a different container, guide it toward that container's opening
    // by using a direction that points toward the opening
    if (currentContainer) {
      const openingDirection = this.getOpeningDirection(currentContainer);
      return {
        position: activeContainer.getMagnet().position,
        direction: openingDirection,
        strength: activeContainer.getMagnet().strength
      };
    }

    // Voroboid is outside all containers - pull toward active container's opening
    const openingCenter = this.getOpeningCenter(activeContainer);
    return {
      position: openingCenter,
      strength: activeContainer.getMagnet().strength
    };
  }

  // Get the container ID for a container instance
  private getContainerIdFor(container: Container): string | undefined {
    for (const [id, c] of this.containers.entries()) {
      if (c === container) return id;
    }
    return undefined;
  }

  // Get direction vector pointing toward a container's opening
  private getOpeningDirection(container: Container): Vec2 {
    switch (container.opening) {
      case 'top': return vec2(0, -1);
      case 'bottom': return vec2(0, 1);
      case 'left': return vec2(-1, 0);
      case 'right': return vec2(1, 0);
    }
  }

  // Get the center point of a container's opening
  private getOpeningCenter(container: Container): Vec2 {
    const x = container.worldX;
    const y = container.worldY;
    const w = container.width;
    const h = container.height;

    switch (container.opening) {
      case 'top': return vec2(x + w / 2, y);
      case 'bottom': return vec2(x + w / 2, y + h);
      case 'left': return vec2(x, y + h / 2);
      case 'right': return vec2(x + w, y + h / 2);
    }
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

      // DEBUG: Draw voroboid position and velocity
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

  private renderContainerWalls(container: Container): void {
    this.ctx.strokeStyle = '#4a4a6a';
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';

    this.ctx.beginPath();
    for (const wall of container.walls) {
      this.ctx.moveTo(wall.start.x, wall.start.y);
      this.ctx.lineTo(wall.end.x, wall.end.y);
    }
    this.ctx.stroke();

    // Render opening side in pink
    this.renderContainerOpening(container);
  }

  // Render the opening side of a container in pink
  private renderContainerOpening(container: Container): void {
    const x = container.worldX;
    const y = container.worldY;
    const w = container.width;
    const h = container.height;

    // Pink color for openings
    this.ctx.strokeStyle = '#ff69b4'; // Hot pink
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = 'round';

    // Draw pink indicator on the opening side
    this.ctx.beginPath();
    switch (container.opening) {
      case 'top':
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x + w, y);
        break;
      case 'bottom':
        this.ctx.moveTo(x, y + h);
        this.ctx.lineTo(x + w, y + h);
        break;
      case 'left':
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x, y + h);
        break;
      case 'right':
        this.ctx.moveTo(x + w, y);
        this.ctx.lineTo(x + w, y + h);
        break;
    }
    this.ctx.stroke();
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

  // Rotate a container's opening
  rotateContainer(containerId: string): void {
    const container = this.containers.get(containerId);
    if (container) {
      container.rotateOpening();
    }
  }

  // Swap active magnet - toggle which bucket's magnet is "on"
  // Both buckets have magnets, this instantly switches which one is active
  shiftMagnets(): void {
    // Toggle between 'a' and 'b'
    this.activeMagnetContainer = this.activeMagnetContainer === 'a' ? 'b' : 'a';
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
