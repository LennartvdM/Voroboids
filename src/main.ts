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

// Register containers
system.registerContainer('a', canvasA);
system.registerContainer('b', canvasB);

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

// Handle window resize
window.addEventListener('resize', () => {
  system.updateContainerPositions();
});

// Update positions on scroll (if applicable)
window.addEventListener('scroll', () => {
  system.updateContainerPositions();
});

console.log('Voroboids initialized. Click "Migrate A → B" to see them fly!');
