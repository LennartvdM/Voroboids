// Voroboids - Entry Point

import { VoroboidsSystem, generateColors } from './voroboids-system';
import type { VoroboidConfig } from './types';

// Initialize the system
const system = new VoroboidsSystem({
  staggerMean: 400,
  staggerStdDev: 150,
  maxSpeed: 6,
  blobRadius: 25,
});

// Get canvas elements
const canvasA = document.getElementById('container-a') as HTMLCanvasElement;
const canvasB = document.getElementById('container-b') as HTMLCanvasElement;

// Register containers with their openings facing each other
// Container A opens to the right, Container B opens to the left
system.registerContainer('a', canvasA, 'right');
system.registerContainer('b', canvasB, 'left');

// Create voroboid configurations
const numVoroboids = 8;
const colors = generateColors(numVoroboids);

const voroboidConfigs: VoroboidConfig[] = colors.map((color, i) => ({
  id: i,
  color,
  weight: 0.8 + Math.random() * 0.4, // Slight weight variation
}));

// Initialize voroboids in container A
system.initializeVoroboids('a', voroboidConfigs);

// Start the animation loop
system.start();

// Set up controls
const migrateRightBtn = document.getElementById('migrate-right') as HTMLButtonElement;
const migrateLeftBtn = document.getElementById('migrate-left') as HTMLButtonElement;
const resetBtn = document.getElementById('reset') as HTMLButtonElement;
const rotateABtn = document.getElementById('rotate-a') as HTMLButtonElement;
const rotateBBtn = document.getElementById('rotate-b') as HTMLButtonElement;

migrateRightBtn.addEventListener('click', () => {
  system.migrate('a', 'b');
});

migrateLeftBtn.addEventListener('click', () => {
  system.migrate('b', 'a');
});

resetBtn.addEventListener('click', () => {
  // Re-initialize in container A
  system.initializeVoroboids('a', voroboidConfigs);
});

rotateABtn.addEventListener('click', () => {
  system.rotateContainer('a');
});

rotateBBtn.addEventListener('click', () => {
  system.rotateContainer('b');
});

// Handle window resize
window.addEventListener('resize', () => {
  system.updateContainerPositions();
});

// Update positions on scroll (if applicable)
window.addEventListener('scroll', () => {
  system.updateContainerPositions();
});

console.log('Voroboids initialized. Click "Migrate A → B" to see them fly!');
