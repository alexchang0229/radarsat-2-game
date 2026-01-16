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
  constructor(column, spawnZ, scene, ground) {
    this.column = column;
    this.clickable = true;
    this.scene = scene;
    this.ground = ground;
    this.TILE_WIDTH = 1.5;
    // Random tile depth between 2 and 6 units
    this.TILE_DEPTH = 2 + Math.random() * 4;
    this.mesh = this.createMesh(column, spawnZ);
    this.hitProgress = 0; // 0 to 1, tracks how much of tile has been hit
    this.isBeingHit = false;
    this.scored = false; // Track if score has been awarded

    // Create progress overlay mesh for color swipe effect
    this.progressMesh = this.createProgressMesh();
  }

  getZBounds() {
    const halfDepth = this.TILE_DEPTH / 2;
    const z = this.mesh.getAbsolutePosition().z;
    return {
      front: z + halfDepth, // Leading edge (closest to bottom)
      back: z - halfDepth   // Trailing edge (farthest from bottom)
    };
  }

  createMesh(column, z) {
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

    // Position tile on sphere surface
    const x = COLUMN_POSITIONS[column];
    const distFromCenter = Math.sqrt(x * x + z * z);
    const yOffset = Math.sqrt(
      Math.max(
        0,
        SPHERE_RADIUS * SPHERE_RADIUS - distFromCenter * distFromCenter
      )
    );

    // Position relative to sphere center
    mesh.position = new Vector3(x, yOffset, z);

    // Calculate surface normal (direction from sphere center to tile)
    const surfaceNormal = new Vector3(x, yOffset, z).normalize();

    // Make tile face outward from sphere (point toward camera)
    // lookAt makes the -Z axis point toward the target, so we look away from center
    const centerPoint = new Vector3(0, 0, 0);
    mesh.lookAt(centerPoint);
    mesh.rotate(Vector3.Up(), Math.PI); // Flip 180 degrees to face outward

    // Parent to ground sphere so it rotates with the sphere
    mesh.parent = this.ground;

    return mesh;
  }

  createProgressMesh() {
    // Create a thin overlay mesh that will grow to show hit progress
    const mesh = MeshBuilder.CreatePlane(
      "tileProgress",
      { width: this.TILE_WIDTH, height: this.TILE_DEPTH },
      this.scene
    );

    const material = new StandardMaterial("progressMaterial", this.scene);
    material.diffuseColor = new Color3(0, 1, 0); // Green for progress
    material.emissiveColor = new Color3(0, 0.6, 0);
    material.backFaceCulling = false;
    mesh.material = material;

    // Parent to the tile mesh so it moves with it
    mesh.parent = this.mesh;
    // Position slightly in front of tile to avoid z-fighting
    mesh.position = new Vector3(0, 0, 0.01);
    // Start with zero height (invisible)
    mesh.scaling.y = 0;
    // Position pivot at back edge (negative Y in local space)
    mesh.setPivotPoint(new Vector3(0, this.TILE_DEPTH / 2, 0));

    return mesh;
  }

  isPassedBottom(threshold) {
    return this.mesh.position.z > threshold;
  }

  startHit() {
    if (!this.clickable) return false;
    console.log("hit started");
    this.isBeingHit = true;
    return true;
  }

  updateHit(deltaTime, tileSpeed) {
    if (!this.isBeingHit || !this.clickable) return;
    // Progress based on how fast the tile moves relative to its depth
    // Time to traverse tile = TILE_DEPTH / tileSpeed
    // So progress per second = tileSpeed / TILE_DEPTH
    const progressPerSecond = tileSpeed / this.TILE_DEPTH;
    this.hitProgress += deltaTime * progressPerSecond;

    // Color swipe effect: grow the progress overlay from back to front
    this.progressMesh.scaling.y = Math.min(this.hitProgress, 1);

    if (this.hitProgress >= 1) {
      this.completeHit();
    }
  }

  stopHit() {
    this.isBeingHit = false;
    // In Guitar Hero, if you let go of a long note early, it "breaks"
    // We reset progress slightly to punish the player
    this.hitProgress = Math.max(0, this.hitProgress - 0.2);
    // Update the progress mesh to reflect the penalty
    this.progressMesh.scaling.y = this.hitProgress;
  }

  completeHit() {
    console.log("complete hit");
    this.clickable = false;
    this.isBeingHit = false;
    // Hide progress mesh and make entire tile green
    this.progressMesh.dispose();
    this.mesh.material.diffuseColor = new Color3(0, 1, 0);
    this.mesh.material.emissiveColor = new Color3(0, 0.8, 0);
  }

  isFullyHit() {
    return this.hitProgress >= 1 && !this.clickable;
  }

  hasScored() {
    return this.scored;
  }

  dispose() {
    if (this.progressMesh) {
      this.progressMesh.dispose();
    }
    this.mesh.dispose();
  }
}

export class TileSpawner {
  constructor(spawnZ = -50, spawnInterval = 1.5, tileSpeed = 15) {
    this.initialSpawnZ = spawnZ;
    this.currentSpawnZ = spawnZ;
    this.spawnInterval = spawnInterval;
    this.tileSpeed = tileSpeed;
    this.timeSinceLastSpawn = 0;
  }

  update(deltaTime, scene, ground) {
    this.timeSinceLastSpawn += deltaTime;

    if (this.timeSinceLastSpawn >= this.spawnInterval) {
      this.timeSinceLastSpawn = 0;

      // Spawn tile at current position
      const tile = this.spawnTile(scene, ground);

      // Move spawn position further back for next tile
      // Distance = speed × time between spawns
      this.currentSpawnZ -= this.tileSpeed * this.spawnInterval;

      return tile;
    }
    return null;
  }

  spawnTile(scene, ground) {
    const column = Math.floor(Math.random() * 4);
    return new Tile(column, this.currentSpawnZ, scene, ground);
  }

  reset() {
    this.currentSpawnZ = this.initialSpawnZ;
    this.timeSinceLastSpawn = 0;
  }
}
