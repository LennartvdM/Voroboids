// Voroboids - Entry Point
// Organisms that flow naturally through openings

import { VoroboidsSystem, generateColors } from './voroboids-system';
import type { VoroboidConfig } from './types';

// Get world elements
const worldCanvas = document.getElementById('world-canvas') as HTMLCanvasElement;
const worldContainer = document.querySelector('.demo-area') as HTMLElement;

// Initialize the system with world canvas
// Water balloon physics: gravity dominates, high damping, collision is reactive
const system = new VoroboidsSystem(worldCanvas, worldContainer, {
  maxSpeed: 4,                 // Slower - water balloons are sluggish
  blobRadius: 25,
  wallRepulsionRange: 60,
  wallRepulsionStrength: 2.5,
  damping: 0.4,                // HEAVY damping - water balloons don't bounce
  gravityStrength: 3.0,        // STRONG gravity - primary force
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
const shiftMagnetsBtn = document.getElementById('shift-magnets') as HTMLButtonElement;

resetBtn?.addEventListener('click', () => {
  system.initializeVoroboids('a', voroboidConfigs);
});

rotateABtn?.addEventListener('click', () => {
  system.rotateContainer('a');
});

rotateBBtn?.addEventListener('click', () => {
  system.rotateContainer('b');
});

shiftMagnetsBtn?.addEventListener('click', () => {
  system.shiftMagnets();
  // Update button text to show which bucket's magnet is active
  const active = system.getActiveMagnetContainer();
  shiftMagnetsBtn.textContent = `Magnet: Bucket ${active.toUpperCase()}`;
});

// Set initial button text
if (shiftMagnetsBtn) {
  shiftMagnetsBtn.textContent = `Magnet: Bucket ${system.getActiveMagnetContainer().toUpperCase()}`;
}

// Handle window resize
window.addEventListener('resize', () => {
  system.updateContainerPositions();
});

console.log('Voroboids initialized. They flow naturally through openings!');
