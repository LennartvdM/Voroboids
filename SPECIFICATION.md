# Swarm UI Specification

## Vision

A novel web UI paradigm where autonomous organisms (cells) create pages through bottom-up behavior rather than top-down hierarchical layouts. Cells behave like a swarm or hive mind — individually autonomous, collectively intelligent — similar to how fish in Finding Nemo form arrows or predator shapes to communicate while remaining individual fish.

**Core principle**: Pages are formations, not locations. Navigation doesn't load new content — it triggers the swarm to reconfigure into a new arrangement.

---

## Philosophical Constraints

### Bottom-Up, Not Top-Down

- Cells must never receive explicit positional commands ("go to x:200, y:150")
- Cells must never be choreographed ("cell A moves first, then cell B")
- Cells must never have externally imposed state changes ("now you're a blob, now you're a Voronoi")
- All complex behavior must emerge from local rules and local awareness

### What's Acceptable

- Cells can have **knowledge**: their destination (from ghost simulation), neighbor positions, container boundaries
- Cells can have **local rules**: seek target, avoid neighbors, respect bounds, maintain shape constraints
- Cells can have **properties that change**: weight, target container, affinity
- Formations can define **intent**: which cells should be prominent, which should shrink, which container they belong to

### What's Not Acceptable

- Global choreography of movement order
- Explicit path prescriptions ("travel in an arc")
- Mode switching ("blob mode vs Voronoi mode")
- Position assignments ("cell 3 goes to slot 7")

---

## The Organism Model

### Single Unified Entity

Each cell is always the same kind of organism. No state changes. No mode flipping. It's a **self-pressurized, constrained Voronoi shape** that:

- Tessellates naturally when packed with neighbors under pressure
- Becomes compact/blob-like when in open space or transit
- Maintains consistent behavior across all situations

### Water Balloon Mental Model

Imagine indestructible water balloons with fixed internal volume:

- In open space: spherical (or circular in 2D)
- Pressed together in a container: they deform into Voronoi-like tessellation
- The physics is the same — only the external pressure differs

There is no "Voronoi mode" vs "blob mode." There's just pressure and volume conservation.

---

## Geometric Constraints

### The Problem with Pure Voronoi

Pure Voronoi tessellation:
- Fills ALL available space by definition
- Stretches infinitely to reach distant edges
- Creates "pizza" shapes when cells span between containers
- Has no intrinsic shape — only neighbor-relative boundaries

### Constrained Voronoi Solution

Cells remain Voronoi-based but with hard geometric constraints:

#### 1. Inscribed Corner Balls

Each corner has an inscribed circle (e.g., 15px radius) that edges cannot violate:
- Edges must remain tangent to or outside the inscribed ball
- Corners cannot close tighter than the angle that accommodates the ball
- Pizza-thin wedges become geometrically impossible
- The ball radius defines the minimum "sharpness" of any corner

#### 2. Convexity Requirement

- Corners can never cross each other
- No concave shapes allowed
- Self-intersection is impossible

#### 3. Maximum Extent

- Cells cannot stretch beyond a maximum ratio of their "ideal" size
- When Voronoi would create an edge too far from cell center, the edge is ignored
- Cell becomes compact, leaving gaps rather than stretching

#### 4. Consistent Gaps

- Minimum gap between cells at all times (aesthetic + buffer zone)
- Collision boundary (forcefield) can overlap with neighbors
- Visual boundary maintains minimum separation (hard constraint)

---

## Physics System

### Not Realistic Physics

This is not a physics simulation seeking realism. No jiggle, no bounce, no overshoot. Cells should:
- Move purposefully, not reactively
- Settle nearly instantaneously (imperceptible settling time)
- Find equilibrium without oscillation

### Core Forces

#### 1. Expansion Pressure (Internal)

Each cell has internal pressure proportional to the difference between target area and current area:
- `targetArea > currentArea` → cell pushes outward, expands
- `targetArea < currentArea` → cell yields, contracts
- `targetArea ≈ currentArea` → cell is satisfied, neutral

This drives cells to fill available space, not clump in the middle.

#### 2. Neighbor Repulsion (Local)

Cells repel neighbors when their collision boundaries (forcefields) overlap:
- Repulsion prevents overlap of visual boundaries
- Forcefield overlap is sensing, not violation
- Predictive avoidance: steer away BEFORE collision, not after

#### 3. Container Attraction (Magnetic Wall)

Containers have one magnetic side that draws cells in:
- Cells can enter from the magnetic side
- Cells cannot leave through non-magnetic walls
- The magnet provides directional flow control

#### 4. Bounds Enforcement

Container walls are hard boundaries:
- Cells cannot escape (except hover protrusion exception)
- Walls provide the pressure that causes tessellation
- Without bounds, cells would expand infinitely

---

## Ghost Simulation (Prescient Cells)

### The Problem

Cells need to know where they're going before they arrive. Reactive physics (bump into things, figure it out) causes overlap during transitions.

### The Solution

When a formation change triggers:

1. **Ghost layer runs ahead** (invisible, fast)
   - Same cells, same physics
   - Runs at high speed (many iterations per frame)
   - Finds equilibrium state

2. **Ghosts settle** → destinations are known
   - Each cell now knows where it will end up
   - Path planning can begin

3. **Real cells animate** toward ghost positions
   - Smooth interpolation
   - Collision avoidance creates curved paths
   - No overlap because paths are planned

4. **Real cells arrive** at equilibrium
   - They're already where they need to be
   - Minimal settling required

### Ghost Mechanics

- Ghosts run whenever formation/weights change
- Must converge quickly (ideally within one frame for 20 cells)
- Ghosts find end state; collision avoidance handles paths

---

## Collision-Free Transitions

### The Hinge Problem

When cells transition from horizontal taskbar to vertical sidebar:
- Straight-line paths would cause outer cells to cross inner cells
- Cells must travel in arcs to avoid collision
- But arcs cannot be imposed top-down

### Emergent Arc Paths

Arcs emerge from local collision avoidance:

Each cell only knows:
1. Where my ghost ended up (destination)
2. Where my neighbors are right now (local awareness)

Cell behavior:
- **Seek**: Accelerate toward destination
- **Avoid**: Steer away from neighbors' predicted positions

When a cell's path is blocked:
- Avoidance force deflects it
- It curves around the obstacle
- The arc is emergent, not prescribed

### First-Out Ordering

Movement order emerges naturally:
- Outer cells have clear paths → they move immediately
- Inner cells are blocked → avoidance halts them
- As outer cells clear, inner cells' paths open
- "First in, last out" emerges from local rules

---

## Containers

### Role of Containers

Containers are:
- Bounded regions that cells inhabit
- Pressure vessels that cause tessellation
- Magnetic attractors with directional flow

Containers are NOT:
- Top-down position assigners
- Choreographers of movement
- Page definitions (formations define pages)

### Container Properties

- **Bounds**: Rectangle with optional border radius
- **Magnetic wall**: One side attracts cells inward
- **Permeability**: Which walls cells can enter/exit through
- **Active state**: Whether the magnet is currently attracting

### Multiple Containers

- Multiple containers can be visible simultaneously
- Cells can migrate between containers through permeable walls
- Formation changes can reassign cells' target containers

### Zero-Magnet State

When no magnet is active:
- Cells maintain current positions (inertia)
- Expansion pressure still applies (cells fill available space)
- They don't "drop" or "roam" — they hold formation

---

## Formations

### What Formations Define

Formations are NOT positional blueprints. They define:

1. **Weight distribution**: Which cells are prominent, which are diminished
2. **Container affinity**: Which container each cell targets
3. **Visibility**: Which cells are active vs dormant

### What Formations DON'T Define

- Exact positions (emerge from physics)
- Movement paths (emerge from collision avoidance)
- Movement order (emerges from blocking)
- Final arrangement (path-dependent based on where cells came from)

### Formation Templates

Formations should be templates, not enumerations:

```
// Template: detail view
{
  primary: { weight: 3, container: 'main', visible: true },
  clicked: { weight: 2, container: 'main', visible: true },
  siblings: { weight: 0.3, container: 'sidebar', visible: true },
  dormant: { weight: 0, container: 'sidebar', visible: false }
}
```

The template applies based on which cell was clicked. Same template, different cells fill the roles.

### Path-Dependent Positions

Because of "first in, last out" physics:
- The same formation reached from different starting points yields different arrangements
- Cell positions depend on transition dynamics, not just target weights
- This is expected and correct — not a bug

---

## Interactions

### Click: Formation Trigger

Clicking a cell triggers a formation change:
- The clicked cell becomes "primary"
- Associated content awakens (dormant cells become visible)
- Weights redistribute according to formation template
- Swarm reconfigures to new equilibrium

### Hover: Temporary Prominence

Hovering a cell:
- Cell gains temporary weight increase
- Cell expands, pushing neighbors (cascade effect)
- Neighbors push their neighbors (ripple)
- Cell can protrude beyond container bounds (exception to normal rules)
- On hover-out, cell returns to normal weight

Hover expansion is fast but animated (smooth transition).

### Hover Protrusion

The hovered cell's exception to container bounds:
- Can bulge outside the container (for visual clarity)
- Cannot fully leave the container
- Other cells respect normal bounds

### Hover + Click Conflict

If a cell is hovered (expanded) and another cell is clicked:
- Formation transition takes precedence
- Hovered cell retracts quickly
- Transition proceeds normally

### Future Interactions (Architecture Must Support)

The base code must accommodate future interactions:
- **Drag**: Moving cells manually
- **Multi-select**: Grouping cells
- **Pinch/zoom**: Mobile scaling
- **Keyboard**: Navigating between cells
- **Long-press**: Alternative actions

These don't need implementation now, but architecture shouldn't preclude them.

---

## Content Model

### Cells vs Container Elements

- **Cells**: Autonomous organisms containing content (images, cards, media)
- **Container elements**: Static UI chrome (headers, titles, navigation, buttons)

Not everything should be a cell. Functional UI elements (buttons, headers) should be traditional DOM or container-level elements. Cells are for content that participates in the swarm.

### Cell Content Types

Cells can contain:
- **Image**: Primary use case (gallery items)
- **Text block**: Expandable content
- **Card**: Compound content (image + text + metadata as single unit)
- **Gradient/color**: Decorative or placeholder

### Content Relationships

- Each cell can have associated dormant cells (detail content)
- Clicking a cell awakens its associated content
- Relationships are defined in data, not hard-coded

### Cells Within Cells

Future capability: cells that contain sub-cells
- A "folder" cell that reveals sub-cells when expanded
- Dynamic filters that group cells into clusters
- Recursive swarm behavior

---

## Technical Requirements

### Platform

- Desktop-first (mobile later)
- Modern browsers only (Chrome, Firefox, Safari, Edge)
- Canvas-based rendering (not DOM per cell)

### Scale

- Target: ~20 cells maximum
- This is sufficient for social media feed-style interfaces
- No need for spatial indexing or complex optimization

### Performance

- Ghost simulation must converge within 1-2 frames
- Transitions should feel instant (imperceptible settling)
- 60fps during interactions

### Framework

- React integration for container/application shell
- Canvas rendering for cell physics and display
- Separation: React manages structure, Canvas manages swarm

---

## Success Criteria

The prototype succeeds when:

1. **Cells travel like a herd of sheep** — making way for each other, going around obstacles
2. **Arc paths emerge naturally** — no straight-line collisions
3. **No overlap during transitions** — ever
4. **No pizza stretching** — cells maintain blob-like compactness when unconstrained
5. **Formations work** — cells arrange themselves based on weight distribution
6. **Hover works** — expansion with cascade, protrusion exception
7. **Settling is imperceptible** — cells arrive at destinations, not wander toward them

---

## Key Unsolved Problems

### 1. Constrained Voronoi Algorithm

How to compute Voronoi tessellation with:
- Inscribed corner ball constraints
- Maximum extent limits
- Convexity guarantees

This may require custom tessellation algorithm or iterative constraint solving.

### 2. Collision-Free Path Planning

How to compute arc paths that:
- Emerge from local avoidance rules
- Guarantee no overlap
- Work for complex formation changes (e.g., taskbar → sidebar hinge)

May require predictive avoidance (velocity obstacles) rather than reactive repulsion.

### 3. Ghost Simulation Speed

How to run ghost simulation fast enough:
- Must converge before animation begins (or stay ahead during)
- 20 cells with constraint solving per frame
- May need simplified physics for ghost layer

### 4. Expansion Pressure Balancing

How to balance expansion pressure with shape constraints:
- Cells want to fill space (expansion)
- Cells can't stretch infinitely (constraints)
- Need equilibrium that fills container without violating constraints

---

## Appendix: Rejected Approaches

### Mode Switching

Cells flip between "blob mode" and "Voronoi mode" based on context.

**Rejected because**: Top-down state imposition. Visually ugly (instant shape change). The organism should be one thing.

### Pure Voronoi

Cells are pure Voronoi with no constraints.

**Rejected because**: Pizza stretching. Cells span containers. No self-contained shape.

### Force-Tuned Repulsion

Cells avoid overlap through carefully tuned repulsion parameters.

**Rejected because**: Brittle. Edge cases always exist. Scale changes break tuning. No guarantees.

### Top-Down Choreography

System prescribes movement order and paths.

**Rejected because**: Violates bottom-up philosophy. Makes system brittle to new interactions. Impossible to maintain as complexity grows.

### Grid Snapping

Cells snap to predefined grid positions in certain formations.

**Rejected because**: Loss of organism autonomy. Cells become pixels, not living things.

---

## Glossary

- **Cell**: An autonomous organism in the swarm
- **Formation**: A weight/affinity distribution that cells achieve through physics
- **Ghost**: Invisible simulation that runs ahead to find equilibrium
- **Container**: A bounded region that cells inhabit
- **Magnetic wall**: A container edge that attracts cells inward
- **Expansion pressure**: Internal force making cells claim their target area
- **Collision boundary/Forcefield**: Sensing zone around visual boundary
- **Inscribed ball**: Geometric constraint preventing sharp corners
- **Prescient**: Cells knowing their destination before arriving
