// VoroboidsSystem - orchestrator for autonomous voroboid agents

import type { VoroboidConfig, FlockConfig, OpeningSide } from './types';
import { DEFAULT_FLOCK_CONFIG } from './types';
import { Voroboid } from './voroboid';
import { Container } from './container';

export class VoroboidsSystem {
  private containers: Map<string, Container> = new Map();
  private config: FlockConfig;

  private lastTime: number = 0;
  private animationId: number | null = null;

  constructor(config: Partial<FlockConfig> = {}) {
    this.config = { ...DEFAULT_FLOCK_CONFIG, ...config };
  }

  // Register a container with its opening side
  registerContainer(id: string, canvas: HTMLCanvasElement, opening: OpeningSide): Container {
    const rect = canvas.getBoundingClientRect();
    const container = new Container(canvas, opening, rect.left, rect.top);
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
    const from = this.containers.get(fromId);
    const to = this.containers.get(toId);

    if (!from || !to) {
      throw new Error('Container not found');
    }

    if (from.voroboids.length === 0) {
      return;
    }

    // Update container positions
    const fromRect = from.canvas.getBoundingClientRect();
    const toRect = to.canvas.getBoundingClientRect();
    from.absoluteX = fromRect.left;
    from.absoluteY = fromRect.top;
    to.absoluteX = toRect.left;
    to.absoluteY = toRect.top;

    // Trigger migration - voroboids will navigate themselves
    from.startMigration(to);
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
    const deltaTime = Math.min(currentTime - this.lastTime, 32); // Cap at ~30fps min
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();

    this.animationId = requestAnimationFrame(this.loop);
  };

  private update(deltaTime: number): void {
    for (const container of this.containers.values()) {
      container.update(deltaTime, this.config);
    }
  }

  private render(): void {
    for (const container of this.containers.values()) {
      container.render();
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

  // Rotate a container's opening (cycles through: right -> bottom -> left -> top)
  rotateContainer(containerId: string): void {
    const container = this.containers.get(containerId);
    if (container) {
      container.rotateOpening();
    }
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
