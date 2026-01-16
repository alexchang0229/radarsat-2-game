# RADARSAT-2 Game - Project Summary

## Project Overview

A 3D piano tiles-style rhythm game built with Babylon.js where players fly through space toward a curved planet surface, hitting tiles as they approach by holding spacebar at the right moment.

## What We Built

A browser-based 3D game featuring:
- Tiles positioned on a large spherical surface (planet)
- Camera fixed in space while the planet rotates, creating the illusion of flight
- Mouse-controlled target zone that players align with incoming tiles
- Hold-to-hit mechanic with visual progress feedback
- Starfield background with 2000+ procedurally placed stars
- Debug labels showing real-time coordinates for gameplay tuning

## Development Journey

### Phase 1: Initial Setup (Three.js)
- Started with Three.js as the 3D engine
- Created basic piano tiles game with vanishing point perspective
- Tiles spawned far away and moved toward camera in straight lines
- Mouse-controlled target zone with spacebar click detection
- 4-column layout similar to classic piano tiles

**Tech Stack**: Three.js, Vite, JavaScript

### Phase 2: Migration to Babylon.js
- Complete rewrite from Three.js to Babylon.js
- Reason: Better performance and built-in features
- Reimplemented all game mechanics with Babylon.js API
- Changed from Three.js scene graph to Babylon.js scene structure

**Key Changes**:
- `THREE.Scene` → `BABYLON.Scene`
- `THREE.PerspectiveCamera` → `BABYLON.FreeCamera`
- `THREE.Mesh` → `BABYLON.MeshBuilder`
- Raycasting using `scene.createPickingRay()`

### Phase 3: Spherical World Transformation
Major gameplay shift: tiles now stick to a curved planet surface

**Implementation**:
- Created large sphere (radius 300) for ground
- Positioned sphere below camera so top surface is visible
- Added wireframe grid for depth perception
- Curved lane dividers using cylinders positioned on sphere surface

**Visual Effect**: Subtle planetary curvature in the game zone

### Phase 4: Rotating Planet Mechanic
Changed from tiles moving to planet rotating

**Concept**: Player is stationary in space, planet rotates toward them

**Technical Solution**:
- Tiles parented to sphere mesh (`mesh.parent = ground`)
- Tiles positioned on sphere surface using sphere equation: x² + y² + z² = r²
- Tiles oriented tangent to sphere (facing outward)
- Sphere rotates around X-axis: `ground.rotation.x += angularVelocity * deltaTime`
- Angular velocity calculated: `ω = v/r` where v=5 units/sec, r=300

**Result**: Camera and target zone fixed, world rotates bringing tiles forward

### Phase 5: Tile Spawning Fix
**Problem**: Tiles spawned at same position, overlapping on rotating sphere

**Solution**:
- `TileSpawner` tracks `currentSpawnZ` position
- Each spawn moves position further back by `distance = speed × interval`
- Tiles spawn at Z = -50, -72.5, -95, -117.5, etc.
- Progressive spacing prevents overlaps

### Phase 6: Starfield Background
Created immersive space environment

**Features**:
- Large inverted sphere (diameter 2000) as skybox
- 2000 procedurally placed stars using spherical coordinates
- Varied star sizes (0.8 to 3.3 units)
- Varied brightness (0.7 to 1.0)
- Color variety:
  - 95% white stars
  - 4% blue-white stars (hot)
  - 1% yellow-orange stars (cool)
- Emissive materials for self-illumination
- `infiniteDistance` flag keeps skybox at horizon

### Phase 7: Visual Enhancement
Made game elements more visible

**Tiles**:
- Changed from dark blue to bright blue (0.3, 0.5, 0.9)
- Added emissive glow (0.1, 0.2, 0.4)
- Tiles face outward from sphere using `lookAt()` + 180° rotation

**Target Zone**:
- Added orange emissive glow
- Thin rectangular shape (1.5 × 0.3 units)

**Background**:
- Dark space color (0.02, 0.02, 0.05)

### Phase 8: Hold-to-Hit Mechanic
Complete gameplay overhaul from click to hold

**Mechanics**:
1. Player holds spacebar while tile is in target zone
2. Hit progress increases over time (0 to 1)
3. Takes ~2 seconds to fully consume a tile
4. Score awarded when `hitProgress >= 1`

**Visual Feedback**:
- Pulsing scale animation (sine wave)
- Color transition: blue → green based on progress
- Emissive glow intensifies
- Target zone turns red while held
- Release early causes partial reset with decay

**Implementation**:
- `InputHandler` tracks spacebar state (`keydown`/`keyup`)
- `Tile` class tracks `hitProgress`, `isBeingHit`, `scored`
- `Game.updateHitDetection()` continuously checks overlaps while held
- Collision detection uses Y-axis (vertical) distance as sphere rotates

### Phase 9: Debug Labels
Added coordinate overlays for gameplay tuning

**Features**:
- Labels linked directly to 3D meshes
- TARGET label: X, Y, Z position
- TILE labels: X, Y, Z position + dX, dY, dZ distances
- Using `@babylonjs/gui` with `linkWithMesh()`
- Real-time updates every frame

**Purpose**: Helped identify that Y-axis (not X-axis) is correct for collision detection

## Final Game Mechanics

### Controls
- **Mouse**: Move target zone horizontally
- **Spacebar Hold**: Hit tiles when aligned with target zone
- **Touch**: Alternative to mouse/spacebar on mobile devices

### Gameplay Loop
1. Tiles spawn far away on sphere surface
2. Sphere rotates, bringing tiles toward player
3. Player positions target zone to align with tile's column
4. Hold spacebar for ~2 seconds to consume tile
5. Tile turns green, score increases
6. Miss a tile → game over

### Scoring System
- +1 point per fully consumed tile
- Tiles must reach `hitProgress >= 1` to score
- Early release causes progress decay, no score

### Collision Detection
- Z-axis: Tile within ±0.2 units of target zone (Z=6)
- Y-axis: Tile within 0.75 units of target zone (vertical alignment)
- Y-axis used because sphere rotation moves tiles vertically in world space

## Technical Architecture

### File Structure
```
radarsat-2-game/
├── index.html              # HTML entry point with UI overlay
├── style.css               # Fullscreen canvas + UI styling
├── package.json            # Dependencies
├── src/
│   ├── main.js            # Entry point, game loop
│   ├── scene.js           # Scene/camera/renderer setup, starfield
│   ├── game.js            # Core game logic, collision detection
│   ├── tile.js            # Tile class, TileSpawner, hit progress
│   └── input.js           # Mouse tracking, spacebar hold detection
└── claude.md              # This document
```

### Key Classes

**`Game`**
- Manages game state (score, gameOver, isHitting)
- Updates sphere rotation
- Spawns tiles via TileSpawner
- Handles collision detection
- Updates debug labels
- Tracks currentHitTile

**`Tile`**
- Positioned on sphere surface
- Tracks hitProgress (0 to 1)
- Visual effects: pulsing, color transition
- Methods: startHit(), updateHit(), stopHit(), completeHit()

**`TileSpawner`**
- Spawns tiles at intervals (1.5 seconds)
- Progressive spawn positioning
- Random column selection (4 columns)

**`InputHandler`**
- Tracks spacebar/touch hold state
- Raycasts mouse to 3D plane for target zone positioning
- Triggers game.onHitStart() / game.onHitEnd()

### Technology Stack
- **Engine**: Babylon.js 6.0
- **GUI**: @babylonjs/gui for debug labels
- **Build Tool**: Vite 5.0
- **Language**: JavaScript (ES Modules)
- **Rendering**: WebGL via Babylon.js

## Key Parameters

```javascript
// Sphere & Movement
sphereRadius: 300           // Large radius for subtle curve
tileSpeed: 5                // Linear velocity (units/sec)
angularVelocity: 0.0167     // Radians/sec (v/r = 5/300)

// Spawning
spawnZ: -50                 // Initial spawn position
spawnInterval: 1.5          // Seconds between spawns

// Hit Detection
targetZPosition: 6          // Target zone Z coordinate
targetZTolerance: 0.2       // ±0.2 units
hitThresholdY: 0.75         // Y-axis distance for hit
hitSpeed: 0.5               // Progress increase per second

// Layout
columns: 4                  // Number of tile lanes
columnPositions: [-2.25, -0.75, 0.75, 2.25]
tileSize: 1.5 × 2          // Width × depth
targetZoneSize: 1.5 × 0.3   // Thin rectangle

// Visuals
starCount: 2000             // Stars in skybox
```

## Design Decisions

### Why Babylon.js over Three.js?
- Better built-in features (scene management, input handling)
- More performant for this use case
- Better GUI integration with @babylonjs/gui

### Why Rotate Sphere Instead of Move Tiles?
- Creates more immersive "flying through space" feeling
- Camera stays fixed, reducing motion sickness potential
- Tiles naturally follow sphere curvature
- Simpler physics model

### Why Y-Axis for Collision Detection?
- Sphere rotates around X-axis
- Rotation moves tiles vertically (Y) in world space
- Mouse moves target horizontally (X), but collision is vertical
- Target zone stays at fixed world position

### Why Hold Instead of Click?
- Creates rhythm game timing challenge
- More skill-based than simple clicking
- Visual feedback (progress bar effect) is satisfying
- Allows for partial hits and recovery

### Why Debug Labels?
- Essential for tuning collision parameters
- Reveals coordinate system understanding
- Helps identify which axes matter for gameplay
- Makes physics visible for iteration

## Performance Considerations

1. **2000 stars**: Each is a small sphere mesh, performance acceptable
2. **Tile cleanup**: Meshes disposed when Z > 10 to prevent memory leaks
3. **Parent hierarchy**: Tiles/dividers parented to sphere for efficient rotation
4. **Delta time**: All movement uses delta time for frame-rate independence
5. **Absolute positioning**: Use `getAbsolutePosition()` for parented meshes

## Future Enhancement Ideas

Not implemented, but discussed:
- Music synchronization (rhythm game aspect)
- Difficulty progression (speed increases)
- Combo multipliers
- Patterned tile sequences (vs random)
- Health system (3 strikes)
- Particle effects on successful hits
- Canvas 2D version (simpler alternative)
- Mobile-first touch controls
- Multiple difficulty levels

## Lessons Learned

1. **Coordinate systems matter**: Understanding which axis changes during rotation is critical
2. **Parent-child relationships**: Parenting objects simplifies complex movement
3. **Visual feedback**: Debug overlays are invaluable during development
4. **Framework migration**: Babylon.js to Three.js requires complete API rewrite
5. **Sphere math**: Positioning objects on sphere surface uses basic sphere equation
6. **Hold mechanics**: More engaging than click for rhythm-based gameplay
7. **Progressive spawning**: Must account for stationary objects on rotating surface

## Credits

- Built with Claude (Anthropic's AI assistant)
- Developer: Alex
- Framework: Babylon.js
- Inspiration: Piano Tiles mobile game

## Running the Game

```bash
npm install
npm run dev
```

Open browser to http://localhost:5173

Controls:
- Move mouse to position target zone
- Hold spacebar to hit tiles
- Release spacebar to stop hitting

Debug mode is currently enabled with coordinate labels on all objects.
