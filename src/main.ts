// Voroboids - Entry Point
// Organisms that flow naturally through openings

import { VoroboidsSystem, generateColors } from './voroboids-system';
import type { VoroboidConfig } from './types';

// Initialize the system
const system = new VoroboidsSystem({
  maxSpeed: 6,
  blobRadius: 25,
  wallRepulsionRange: 50,
  wallRepulsionStrength: 2.0,
  damping: 0.02,
  separationWeight: 1.5,
  cohesionWeight: 0.8,
  alignmentWeight: 0.5,
});

// Get canvas elements
const canvasA = document.getElementById('container-a') as HTMLCanvasElement;
const canvasB = document.getElementById('container-b') as HTMLCanvasElement;

// Register containers - their openings face each other
// Container A opens to the right, Container B opens to the left
system.registerContainer('a', canvasA, 'right');
system.registerContainer('b', canvasB, 'left');

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

// Update positions on scroll
window.addEventListener('scroll', () => {
  system.updateContainerPositions();
});

console.log('Voroboids initialized. They will flow naturally through openings!');
