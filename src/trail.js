import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
} from "@babylonjs/core";
import { SPHERE_RADIUS, HEIGHT_OFFSET, TILE_WIDTHS } from "./config.js";
export const TRAIL_HEIGHT = 0.12;

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
    this.width = TILE_WIDTHS[widthIndex] * 1.1;
    this.mesh = this.createMesh(x, theta);
    this.highlightMesh = null;
    this.isHighlighted = false;
  }

  createMesh(x, theta) {
    const mesh = MeshBuilder.CreatePlane("trail", { width: this.width, height: TRAIL_HEIGHT }, this.scene);
    const material = new StandardMaterial("trailMaterial", this.scene);
    material.diffuseColor = TRAIL_COLOR_NORMAL.clone();
    material.emissiveColor = TRAIL_EMISSIVE_NORMAL.clone();
    material.backFaceCulling = false;
    material.disableDepthWrite = true;
    mesh.material = material;

    const effectiveRadius = Math.sqrt(SPHERE_RADIUS ** 2 - x ** 2) + HEIGHT_OFFSET;
    mesh.position = new Vector3(x, effectiveRadius * Math.sin(theta), effectiveRadius * Math.cos(theta));
    mesh.rotation.x = -theta;
    mesh.parent = this.ground;

    return mesh;
  }

  setHighlighted(tileX, tileWidth) {
    if (this.isHighlighted) return;
    this.isHighlighted = true;

    const overlapLeft = Math.max(this.x - this.width / 2, tileX - tileWidth / 2);
    const overlapRight = Math.min(this.x + this.width / 2, tileX + tileWidth / 2);
    const overlapWidth = overlapRight - overlapLeft;
    if (overlapWidth <= 0) return;

    this.highlightMesh = MeshBuilder.CreatePlane("trailHighlight", { width: overlapWidth, height: TRAIL_HEIGHT }, this.scene);
    const material = new StandardMaterial("trailHighlightMaterial", this.scene);
    material.diffuseColor = TRAIL_COLOR_HIT;
    material.emissiveColor = TRAIL_EMISSIVE_HIT;
    material.backFaceCulling = false;
    material.disableDepthWrite = true;
    this.highlightMesh.material = material;
    this.highlightMesh.parent = this.mesh;
    this.highlightMesh.position = new Vector3((overlapLeft + overlapRight) / 2 - this.x, 0, 0.01);
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

  spawnTrails(groundRotation, scene, ground) {
    if (!this.isSpawning || this.lastSpawnRotation === null) return;

    const xOffset = -0.3;
    // Use full trail height for spacing to prevent overlap and double-counting coverage
    const angularSpacing = TRAIL_HEIGHT / (SPHERE_RADIUS + HEIGHT_OFFSET);
    const trailsToSpawn = Math.floor((groundRotation - this.lastSpawnRotation) / angularSpacing);

    for (let i = 0; i < trailsToSpawn; i++) {
      const theta = this.lastSpawnRotation + (i + 1) * angularSpacing + Math.PI / 2;
      this.trails.push(new Trail(this.spawnX + xOffset, theta, scene, ground, this.spawnWidthIndex));
    }

    if (trailsToSpawn > 0) {
      this.lastSpawnRotation += trailsToSpawn * angularSpacing;
    }
  }

  update(deltaTime, angularVelocity, tiles) {
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      trail.updateAge(deltaTime);

      if (!trail.isHighlighted) {
        const trailPos = trail.mesh.getAbsolutePosition();
        for (const tile of tiles) {
          if (!tile.clickable || trail.widthIndex !== tile.widthIndex) continue;

          const tilePos = tile.mesh.getAbsolutePosition();
          const bounds = tile.getZBounds();
          const trailInTile = trailPos.z >= bounds.back && trailPos.z <= bounds.front;
          const xOverlap = Math.abs(trailPos.x - tilePos.x) < (trail.width + tile.TILE_WIDTH) / 2;

          if (trailInTile && xOverlap) {
            trail.setHighlighted(tilePos.x, tile.TILE_WIDTH);
            tile.addTrailCoverage(trail.x, trail.width, TRAIL_HEIGHT);
            break;
          }
        }
      }

      if ((trail.age * angularVelocity * 180) / Math.PI > 20) {
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
