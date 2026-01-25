import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
} from "@babylonjs/core";
import { SPHERE_RADIUS, HEIGHT_OFFSET, TILE_WIDTHS } from "./config.js";
export const TRAIL_HEIGHT = 0.17;

const TRAIL_COLOR_NORMAL = new Color3(1, 1, 0);
const TRAIL_EMISSIVE_NORMAL = new Color3(0.7, 0.7, 0);
const TRAIL_COLOR_HIT = new Color3(0, 1, 0); // Green when overlapping tile
const TRAIL_EMISSIVE_HIT = new Color3(0, 0.8, 0);

export class Trail {
  constructor(x, theta, scene, ground, widthIndex) {
    this.scene = scene;
    this.ground = ground;
    this.age = 0;
    this.x = x; // Store x position for overlap checking
    this.widthIndex = widthIndex; // Store width index for matching
    this.width = TILE_WIDTHS[widthIndex];
    this.mesh = this.createMesh(x, theta);
    this.highlightMesh = null;
    this.isHighlighted = false;
  }

  createMesh(x, theta) {
    const mesh = MeshBuilder.CreatePlane(
      "trail",
      { width: this.width, height: TRAIL_HEIGHT },
      this.scene
    );

    const material = new StandardMaterial("trailMaterial", this.scene);
    material.diffuseColor = TRAIL_COLOR_NORMAL.clone();
    material.emissiveColor = TRAIL_EMISSIVE_NORMAL.clone();
    material.alpha = 1;
    material.backFaceCulling = false;
    material.disableDepthWrite = true; // Prevent overlapping trails from accumulating opacity
    mesh.material = material;

    // Spherical coordinates: Y and Z on the sphere surface
    const effectiveRadius = Math.sqrt(SPHERE_RADIUS ** 2 - x ** 2) + HEIGHT_OFFSET;
    const y = effectiveRadius * Math.sin(theta);
    const z = effectiveRadius * Math.cos(theta);

    mesh.position = new Vector3(x, y, z);

    // Set rotation directly based on theta to avoid gimbal lock at poles
    // The plane needs to be tangent to the sphere surface
    // Rotate around X-axis by theta, then lay flat (rotate around local Z)
    mesh.rotation.x = -theta;

    // Parent to ground so it rotates with the sphere
    mesh.parent = this.ground;

    return mesh;
  }

  setHighlighted(tileX, tileWidth) {
    if (this.isHighlighted) return;
    this.isHighlighted = true;

    // Calculate the overlap region
    const trailLeft = this.x - this.width / 2;
    const trailRight = this.x + this.width / 2;
    const tileLeft = tileX - tileWidth / 2;
    const tileRight = tileX + tileWidth / 2;

    // Find intersection
    const overlapLeft = Math.max(trailLeft, tileLeft);
    const overlapRight = Math.min(trailRight, tileRight);
    const overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth <= 0) return;

    // Create highlight mesh only for the overlapping portion
    this.highlightMesh = MeshBuilder.CreatePlane(
      "trailHighlight",
      { width: overlapWidth, height: TRAIL_HEIGHT },
      this.scene
    );

    const material = new StandardMaterial("trailHighlightMaterial", this.scene);
    material.diffuseColor = TRAIL_COLOR_HIT;
    material.emissiveColor = TRAIL_EMISSIVE_HIT;
    material.alpha = 1;
    material.backFaceCulling = false;
    material.disableDepthWrite = true;
    this.highlightMesh.material = material;

    // Parent to main trail mesh so it moves with it
    this.highlightMesh.parent = this.mesh;

    // Position the highlight relative to trail center
    const overlapCenterX = (overlapLeft + overlapRight) / 2;
    const offsetX = overlapCenterX - this.x;
    this.highlightMesh.position = new Vector3(offsetX, 0, 0.01); // Slightly in front to avoid z-fighting
  }

  updateAge(deltaTime) {
    this.age += deltaTime;
  }

  dispose() {
    if (this.highlightMesh) {
      this.highlightMesh.dispose();
    }
    this.mesh.dispose();
  }
}

export class TrailSpawner {
  constructor() {
    this.trails = [];
    this.lastSpawnRotation = null; // Track last spawn position
    this.isSpawning = false;
    this.spawnX = 0;
    this.spawnWidthIndex = 0;
  }

  // Start continuous trail spawning
  startSpawning(x, widthIndex, groundRotation) {
    this.isSpawning = true;
    this.spawnX = x;
    this.spawnWidthIndex = widthIndex;
    this.lastSpawnRotation = groundRotation;
  }

  // Update spawn position (for mouse movement while spawning)
  updateSpawnPosition(x, widthIndex) {
    this.spawnX = x;
    this.spawnWidthIndex = widthIndex;
  }

  // Stop spawning
  stopSpawning() {
    this.isSpawning = false;
    this.lastSpawnRotation = null;
  }

  // Spawn trails at fixed intervals based on rotation, filling any gaps
  spawnTrails(groundRotation, scene, ground) {
    if (!this.isSpawning || this.lastSpawnRotation === null) return;

    const xOffset = -0.3;
    // Calculate angular spacing to avoid too much overlap
    // TRAIL_HEIGHT is the trail size, we want slight overlap for continuity
    // Angular spacing = arc length / radius, where arc length ≈ TRAIL_HEIGHT * 0.8 (20% overlap)
    const effectiveRadius = SPHERE_RADIUS + HEIGHT_OFFSET;
    const angularSpacing = (TRAIL_HEIGHT * 0.8) / effectiveRadius;

    // Calculate how many trails to spawn to fill the gap
    const rotationDelta = groundRotation - this.lastSpawnRotation;
    const trailsToSpawn = Math.floor(rotationDelta / angularSpacing);

    for (let i = 0; i < trailsToSpawn; i++) {
      const spawnRotation = this.lastSpawnRotation + (i + 1) * angularSpacing;
      const theta = spawnRotation + Math.PI / 2;
      const trail = new Trail(this.spawnX + xOffset, theta, scene, ground, this.spawnWidthIndex);
      this.trails.push(trail);
    }

    // Update last spawn rotation
    if (trailsToSpawn > 0) {
      this.lastSpawnRotation += trailsToSpawn * angularSpacing;
    }
  }

  createTrail(x, groundRotation, scene, ground, widthIndex) {
    // Calculate theta based on current ground rotation
    // 90 degrees from current rotation is where the target zone is
    const xOffset = -0.3
    const theta = groundRotation + Math.PI / 2;
    const trail = new Trail(x + xOffset, theta, scene, ground, widthIndex);
    this.trails.push(trail);
    return trail;
  }

  update(deltaTime, angularVelocity, tiles) {
    // Update trail ages and remove old ones
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      trail.updateAge(deltaTime);

      // Only check overlap if not already highlighted (trails don't move relative to tiles)
      if (!trail.isHighlighted) {
        const trailPos = trail.mesh.getAbsolutePosition();

        for (const tile of tiles) {
          if (!tile.clickable) continue;

          // Only count coverage if trail width matches tile width
          if (trail.widthIndex !== tile.widthIndex) continue;

          const tilePos = tile.mesh.getAbsolutePosition();
          const xDist = Math.abs(trailPos.x - tilePos.x);
          const bounds = tile.getZBounds();

          // Check if trail Z is within tile's front and back edges
          const trailInTile = trailPos.z >= bounds.back && trailPos.z <= bounds.front;

          // Check X overlap: two rectangles overlap if distance < sum of half-widths
          const xOverlap = xDist < (trail.width + tile.TILE_WIDTH) / 2;

          if (trailInTile && xOverlap) {
            trail.setHighlighted(tilePos.x, tile.TILE_WIDTH);
            // Add this trail's coverage to the tile
            tile.addTrailCoverage(trail.x, trail.width, TRAIL_HEIGHT);
            break;
          }
        }
      }

      // Remove trails after they've rotated 20 degrees
      const rotationAngleDegrees = (trail.age * angularVelocity * 180) / Math.PI;
      if (rotationAngleDegrees > 20) {
        trail.dispose();
        this.trails.splice(i, 1);
      }
    }
  }

  reset() {
    for (const trail of this.trails) {
      trail.dispose();
    }
    this.trails = [];
    this.lastSpawnRotation = null;
    this.isSpawning = false;
  }
}
