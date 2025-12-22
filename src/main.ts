// Voroboids - Entry Point
// Organisms that flow naturally through openings

import { VoroboidsSystem, generateColors } from './voroboids-system';
import type { VoroboidConfig } from './types';

// Get world elements
const worldCanvas = document.getElementById('world-canvas') as HTMLCanvasElement;
const worldContainer = document.querySelector('.demo-area') as HTMLElement;

// Initialize the system with world canvas
const system = new VoroboidsSystem(worldCanvas, worldContainer, {
  maxSpeed: 6,
  blobRadius: 25,
  wallRepulsionRange: 50,
  wallRepulsionStrength: 2.0,
  damping: 0.02,
  separationWeight: 1.5,
  cohesionWeight: 0.8,
  alignmentWeight: 0.5,
});

// Get container elements (divs, not canvases)
const containerA = document.getElementById('container-a') as HTMLElement;
const containerB = document.getElementById('container-b') as HTMLElement;

// Register containers - their openings face each other
system.registerContainer('a', containerA, 'right');
system.registerContainer('b', containerB, 'left');

// Create voroboid configurations
const numVoroboids = 8;
const colors = generateColors(numVoroboids);

const voroboidConfigs: VoroboidConfig[] = colors.map((color, i) => ({
  id: i,
  color,
  weight: 0.8 + Math.random() * 0.4,
}));

// Initialize voroboids in container A
system.initializeVoroboids('a', voroboidConfigs);

// Start the animation loop
system.start();

// Set up controls
const resetBtn = document.getElementById('reset') as HTMLButtonElement;
const rotateABtn = document.getElementById('rotate-a') as HTMLButtonElement;
const rotateBBtn = document.getElementById('rotate-b') as HTMLButtonElement;

resetBtn?.addEventListener('click', () => {
  system.initializeVoroboids('a', voroboidConfigs);
});

rotateABtn?.addEventListener('click', () => {
  system.rotateContainer('a');
});

rotateBBtn?.addEventListener('click', () => {
  system.rotateContainer('b');
});

// Handle window resize
window.addEventListener('resize', () => {
  system.updateContainerPositions();
});

console.log('Voroboids initialized. They flow naturally through openings!');
