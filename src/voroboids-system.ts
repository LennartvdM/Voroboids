// VoroboidsSystem - main orchestrator for the entire system

import type { VoroboidConfig, FlockConfig } from './types';
import { DEFAULT_FLOCK_CONFIG } from './types';
import { Voroboid } from './voroboid';
import { Container } from './container';
import { FlightRenderer } from './flight-renderer';

export class VoroboidsSystem {
  private containers: Map<string, Container> = new Map();
  private flightRenderer: FlightRenderer;
  private config: FlockConfig;

  private lastTime: number = 0;
  private animationId: number | null = null;
  private isMigrating: boolean = false;
  private targetContainerId: string | null = null;

  constructor(config: Partial<FlockConfig> = {}) {
    this.config = { ...DEFAULT_FLOCK_CONFIG, ...config };
    this.flightRenderer = new FlightRenderer();
  }

  // Register a container
  registerContainer(id: string, canvas: HTMLCanvasElement): Container {
    const rect = canvas.getBoundingClientRect();
    const container = new Container(canvas, rect.left, rect.top);
    this.containers.set(id, container);
    return container;
  }

  // Initialize voroboids in a container
  initializeVoroboids(containerId: string, configs: VoroboidConfig[]): void {
    const container = this.containers.get(containerId);
    if (!container) {
      throw new Error(`Container ${containerId} not found`);
    }

    const voroboids = configs.map(cfg => new Voroboid(cfg));
    container.setVoroboids(voroboids);
  }

  // Migrate voroboids from one container to another
  migrate(fromId: string, toId: string): void {
    if (this.isMigrating) return;

    const from = this.containers.get(fromId);
    const to = this.containers.get(toId);

    if (!from || !to) {
      throw new Error('Container not found');
    }

    if (from.voroboids.length === 0) {
      return; // Nothing to migrate
    }

    // Update container positions
    const fromRect = from.canvas.getBoundingClientRect();
    const toRect = to.canvas.getBoundingClientRect();
    from.absoluteX = fromRect.left;
    from.absoluteY = fromRect.top;
    to.absoluteX = toRect.left;
    to.absoluteY = toRect.top;

    // Prepare migration
    const voroboids = [...from.voroboids];
    from.prepareMigration(to, this.config);

    // Hand off to flight renderer
    this.flightRenderer.setFlyingVoroboids(voroboids);
    this.isMigrating = true;
    this.targetContainerId = toId;
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
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    this.update(deltaTime, currentTime);
    this.render(currentTime);

    this.animationId = requestAnimationFrame(this.loop);
  };

  private update(deltaTime: number, currentTime: number): void {
    // Update all containers
    for (const container of this.containers.values()) {
      container.update(deltaTime, currentTime, this.config);
    }

    // Update flying voroboids
    if (this.isMigrating) {
      this.flightRenderer.update(deltaTime, currentTime, this.config);

      // Check if all have arrived
      if (this.flightRenderer.allArrived() && this.targetContainerId) {
        const targetContainer = this.containers.get(this.targetContainerId);
        if (targetContainer) {
          // Transfer voroboids to target container
          const arrivedVoroboids = this.flightRenderer.getArrivedVoroboids();
          if (arrivedVoroboids.length > 0) {
            // Adjust positions from absolute to container-relative
            for (const v of arrivedVoroboids) {
              v.position.x -= targetContainer.absoluteX;
              v.position.y -= targetContainer.absoluteY;
            }
            targetContainer.setVoroboids(arrivedVoroboids);
          }
          this.flightRenderer.clear();
          this.isMigrating = false;
          this.targetContainerId = null;
        }
      }
    }
  }

  private render(time: number): void {
    // Render all containers
    for (const container of this.containers.values()) {
      container.render(time);
    }

    // Render flying voroboids
    if (this.isMigrating) {
      this.flightRenderer.render(time);
    }
  }

  // Update container positions (call on resize/scroll)
  updateContainerPositions(): void {
    for (const container of this.containers.values()) {
      const rect = container.canvas.getBoundingClientRect();
      container.absoluteX = rect.left;
      container.absoluteY = rect.top;
    }
  }
}

// Generate color palette
export function generateColors(count: number): string[] {
  const colors: string[] = [];
  const baseHues = [340, 280, 200, 160, 40, 20]; // Pink, purple, blue, teal, yellow, orange

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
