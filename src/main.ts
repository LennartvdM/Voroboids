// Voroboids - Entry Point
// Maxwell's Demon containers with directional walls

import { VoroboidsSystem, generateColors } from './voroboids-system';
import type { VoroboidConfig } from './types';

// Get world elements
const worldCanvas = document.getElementById('world-canvas') as HTMLCanvasElement;
const worldContainer = document.querySelector('.demo-area') as HTMLElement;

// Initialize the system with world canvas
const system = new VoroboidsSystem(worldCanvas, worldContainer, {
  maxSpeed: 4,
  blobRadius: 25,
  wallRepulsionRange: 60,
  wallRepulsionStrength: 2.5,
  damping: 0.4,
  gravityStrength: 3.0,
});

// Get container elements (divs, not canvases)
const containerA = document.getElementById('container-a') as HTMLElement;
const containerB = document.getElementById('container-b') as HTMLElement;

// Register containers with Maxwell's Demon walls
// Container A starts with inward polarity (trapping), B starts with solid
system.registerContainer('a', containerA, 'inward');
system.registerContainer('b', containerB, 'solid');

// Create voroboid configurations with VARIED WEIGHTS
const numVoroboids = 8;
const colors = generateColors(numVoroboids);

// Create cells with deliberately varied weights to show the negotiation
const weights = [2.0, 0.5, 1.5, 0.6, 1.8, 0.7, 1.2, 0.8];

const voroboidConfigs: VoroboidConfig[] = colors.map((color, i) => ({
  id: i,
  color,
  weight: weights[i % weights.length],
}));

// Initialize voroboids in container A
system.initializeVoroboids('a', voroboidConfigs);

// Start the animation loop
system.start();

// Set up controls
const resetBtn = document.getElementById('reset') as HTMLButtonElement;
const pourABtn = document.getElementById('pour-a') as HTMLButtonElement;
const pourBBtn = document.getElementById('pour-b') as HTMLButtonElement;

resetBtn?.addEventListener('click', () => {
  // Reset to initial state: A trapping, B solid
  system.getContainer('a')?.setPolarity('inward');
  system.getContainer('b')?.setPolarity('solid');
  system.initializeVoroboids('a', voroboidConfigs);
});

pourABtn?.addEventListener('click', () => {
  system.pourTo('a');
});

pourBBtn?.addEventListener('click', () => {
  system.pourTo('b');
});

// Handle window resize
window.addEventListener('resize', () => {
  system.updateContainerPositions();
});

// Keyboard controls
window.addEventListener('keydown', (e) => {
  if (e.key === 'd' || e.key === 'D') {
    const isDebug = system.toggleDebug();
    console.log(`Debug mode: ${isDebug ? 'ON' : 'OFF'}`);
    console.log('Debug shows: w = weight (claim on space), p = pressure (compression feedback)');
  }
});

console.log('Voroboids - Maxwell\'s Demon containers!');
console.log('Walls are directional membranes: inward (purple) traps, outward (teal) releases');
console.log('Press D to toggle debug mode');
