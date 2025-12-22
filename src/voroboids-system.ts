// VoroboidsSystem - unified world containing all voroboids and walls
// Voroboids exist in world space and interact with all walls/neighbors globally

import type { VoroboidConfig, FlockConfig, Wall } from './types';
import { DEFAULT_FLOCK_CONFIG } from './types';
import { Voroboid } from './voroboid';
import { Container, OpeningSide } from './container';
import { vec2 } from './math';

export class VoroboidsSystem {
  private containers: Map<string, Container> = new Map();
  private voroboids: Voroboid[] = [];
  private config: FlockConfig;

  private lastTime: number = 0;
  private animationId: number | null = null;

  constructor(config: Partial<FlockConfig> = {}) {
    this.config = { ...DEFAULT_FLOCK_CONFIG, ...config };
  }

  // Register a container (region with walls)
  registerContainer(id: string, canvas: HTMLCanvasElement, opening: OpeningSide): Container {
    const rect = canvas.getBoundingClientRect();
    const container = new Container(canvas, opening, rect.left, rect.top);
    this.containers.set(id, container);
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

    // Create voroboids and position them within the container
    const padding = 40;
    for (const cfg of configs) {
      const voroboid = new Voroboid(cfg);
      voroboid.blobRadius = this.config.blobRadius;

      // Position in world space within the container
      voroboid.position = vec2(
        container.worldX + padding + Math.random() * (container.width - padding * 2),
        container.worldY + padding + Math.random() * (container.height - padding * 2)
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
    // Get all walls in the world
    const allWalls = this.getAllWalls();

    // Update each voroboid with global awareness
    for (const voroboid of this.voroboids) {
      voroboid.update(deltaTime, this.voroboids, allWalls, this.config);
    }
  }

  private render(): void {
    // Each container renders voroboids visible in its region
    for (const container of this.containers.values()) {
      container.render(this.voroboids);
    }
  }

  // Update container positions (call on resize/scroll)
  updateContainerPositions(): void {
    for (const container of this.containers.values()) {
      const rect = container.canvas.getBoundingClientRect();
      container.setWorldPosition(rect.left, rect.top);
    }
  }

  // Rotate a container's opening
  rotateContainer(containerId: string): void {
    const container = this.containers.get(containerId);
    if (container) {
      container.rotateOpening();
    }
  }

  // Get voroboids (for external access if needed)
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
