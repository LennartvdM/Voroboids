# Voroboids

Voronoi cells that behave like boids - flowing between containers like Venom symbiote or Metroid X parasites.

## Concept

Voroboids exist in three states:

1. **Contained** - Voronoi treemap cells filling a container
2. **Transitioning** - Wiggly amorphous blobs traveling in a flock with staggered timing along bezier arcs (teh tarik style)
3. **Settling** - Reform into voronoi cells in the new container

## Features

- Voronoi cell generation with Lloyd relaxation
- Boid flocking behaviors (separation, alignment, cohesion)
- Blob/amorphous shape rendering with wobble effects
- Bezier curve path generation for organic flight arcs
- Staggered launch system using normal distribution
- State machine for smooth transitions
- Container-to-container migration

## Usage

```bash
npm install
npm run dev
```

Then open the displayed URL in your browser and click the migration buttons.

## Architecture

- `src/voroboid.ts` - Individual voroboid with state machine
- `src/container.ts` - Container managing voronoi layout
- `src/flight-renderer.ts` - Overlay canvas for cross-container flight
- `src/voroboids-system.ts` - Main orchestrator
- `src/math.ts` - Vector math, bezier curves, easing functions
- `src/types.ts` - TypeScript type definitions
