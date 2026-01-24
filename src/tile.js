import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
} from "@babylonjs/core";

// Tile configuration

const COLUMN_POSITIONS = [-2.25, -0.75, 0.75, 2.25]; // 4 columns
const SPHERE_RADIUS = 300;

export class Tile {
  constructor(column, spawnTheta, scene, ground) {
    this.column = column;
    this.clickable = true;
    this.scene = scene;
    this.spawnTheta = spawnTheta;
    this.ground = ground;
    this.TILE_WIDTH = 1.5;
    // Random tile depth between 2 and 6 units
    this.TILE_DEPTH = 2 + Math.random() * 4;
    this.mesh = this.createMesh(column, spawnTheta);
    this.age = 0; // Track time since tile creation

    // Coverage tracking - accumulates trail overlap area
    this.totalCoverageArea = 0; // Total area covered by trails
    this.tileArea = this.TILE_WIDTH * this.TILE_DEPTH; // Total tile area
    this.hasPassedTarget = false; // Whether tile has completely passed target zone
    this.coveragePercent = 0; // Final coverage percentage
  }

  getZBounds() {
    const halfDepth = this.TILE_DEPTH / 2;
    const z = this.mesh.getAbsolutePosition().z;
    return {
      front: z + halfDepth, // Leading edge (closest to bottom)
      back: z - halfDepth   // Trailing edge (farthest from bottom)
    };
  }

  getXBounds() {
    const halfWidth = this.TILE_WIDTH / 2;
    const x = this.mesh.getAbsolutePosition().x;
    return {
      left: x - halfWidth,
      right: x + halfWidth
    };
  }

  // Add coverage from a trail overlap
  // trailX: center X position of trail
  // trailWidth: width of the trail
  // trailHeight: height of the trail segment
  addTrailCoverage(trailX, trailWidth, trailHeight) {
    if (this.hasPassedTarget) return;

    // Calculate X overlap between trail and tile
    const tileXBounds = this.getXBounds();
    const trailLeft = trailX - trailWidth / 2;
    const trailRight = trailX + trailWidth / 2;

    const overlapLeft = Math.max(tileXBounds.left, trailLeft);
    const overlapRight = Math.min(tileXBounds.right, trailRight);
    const overlapWidth = Math.max(0, overlapRight - overlapLeft);

    if (overlapWidth > 0) {
      // Add the overlap area (width * height of trail segment)
      const overlapArea = overlapWidth * trailHeight;
      this.totalCoverageArea += overlapArea;
    }
  }

  // Check if tile has completely passed the target zone (back edge past Z=0)
  checkPassedTarget() {
    if (this.hasPassedTarget) return false;

    const bounds = this.getZBounds();
    // Tile has passed when its back edge is past Z=0
    if (bounds.back > 0) {
      this.hasPassedTarget = true;
      this.clickable = false;
      // Calculate final coverage percentage (capped at 100%)
      this.coveragePercent = Math.min(100, (this.totalCoverageArea / this.tileArea) * 100);
      return true; // Just passed
    }
    return false;
  }

  getCoveragePercent() {
    return this.coveragePercent;
  }

  createMesh(column, spawnTheta) {
    const mesh = MeshBuilder.CreatePlane(
      "tile",
      { width: this.TILE_WIDTH, height: this.TILE_DEPTH },
      this.scene
    );

    const material = new StandardMaterial("tileMaterial", this.scene);
    material.diffuseColor = new Color3(0.3, 0.5, 0.9); // Bright blue for visibility
    material.emissiveColor = new Color3(0.1, 0.2, 0.4); // Slight glow
    material.specularColor = new Color3(0.5, 0.5, 0.5);
    material.backFaceCulling = false;
    mesh.material = material;

    // Position tile on sphere surface using spherical coordinates
    // Theta is 90 degrees (PI/2) ahead of player, measured from sphere's rotation
    // Y = R * sin(theta), Z = R * cos(theta)
    const x = COLUMN_POSITIONS[column];

    // Calculate theta: start at 90 degrees (PI/2) ahead, plus the spawn offset
    // spawnTheta is the additional angle offset for progressive spawning
    const theta = spawnTheta + 120 * Math.PI / 180

    // Spherical coordinates: Y and Z on the sphere surface
    // Account for x offset by reducing the effective radius in the YZ plane
    const effectiveRadius = Math.sqrt(SPHERE_RADIUS ** 2 - x ** 2) - 0.1;
    const y = effectiveRadius * Math.sin(theta);
    const z = effectiveRadius * Math.cos(theta);
    // Position relative to sphere center (sphere is centered at origin)
    mesh.position = new Vector3(x, y, z);

    mesh.rotation.x = -theta; // Flip 180 degrees to face outward

    // Parent to ground sphere so it rotates with the sphere
    mesh.parent = this.ground;

    return mesh;
  }

  updateAge(deltaTime) {
    this.age += deltaTime;
  }

  dispose() {
    this.mesh.dispose();
  }
}

export class TileSpawner {
  constructor(spawnInterval = 1.5, angularVelocity = 0.0167) {
    this.currentSpawnTheta = 0;
    this.spawnInterval = spawnInterval;
    this.angularVelocity = angularVelocity; // Radians per second (matches sphere rotation)
    this.timeSinceLastSpawn = 0;
  }

  update(deltaTime, scene, ground) {
    this.timeSinceLastSpawn += deltaTime;

    if (this.timeSinceLastSpawn >= this.spawnInterval) {
      this.timeSinceLastSpawn = 0;

      // Spawn tile at current theta position
      const tile = this.spawnTile(scene, ground);

      // Move spawn angle further ahead for next tile
      // Angular distance = angular velocity × time between spawns
      this.currentSpawnTheta += this.angularVelocity * this.spawnInterval;

      return tile;
    }
    return null;
  }

  spawnTile(scene, ground) {
    const column = Math.floor(Math.random() * 4);
    return new Tile(column, this.currentSpawnTheta, scene, ground);
  }

  reset() {
    this.currentSpawnTheta = 0;
    this.timeSinceLastSpawn = 0;
  }
}
