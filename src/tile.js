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
    this.spawnTheta = spawnTheta
    this.ground = ground;
    this.TILE_WIDTH = 1.5;
    // Random tile depth between 2 and 6 units
    this.TILE_DEPTH = 2 + Math.random() * 4;
    this.mesh = this.createMesh(column, spawnTheta);
    this.hitProgress = 0; // 0 to 1, tracks how much of tile has been hit
    this.isBeingHit = false;
    this.scored = false; // Track if score has been awarded
    this.age = 0; // Track time since tile creation
  }

  getZBounds() {
    const halfDepth = this.TILE_DEPTH / 2;
    const z = this.mesh.getAbsolutePosition().z;
    return {
      front: z + halfDepth, // Leading edge (closest to bottom)
      back: z - halfDepth   // Trailing edge (farthest from bottom)
    };
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

    if (this.hitProgress >= 1) {
      this.completeHit();
    }
  }

  stopHit() {
    this.isBeingHit = false;
    // In Guitar Hero, if you let go of a long note early, it "breaks"
    // We reset progress slightly to punish the player
    this.hitProgress = Math.max(0, this.hitProgress - 0.2);
  }

  completeHit() {
    console.log("complete hit");
    this.clickable = false;
    this.isBeingHit = false;
    // Make entire tile green when completed
    // this.mesh.material.diffuseColor = new Color3(0, 1, 0);
    // this.mesh.material.emissiveColor = new Color3(0, 0.8, 0);
  }

  isFullyHit() {
    return this.hitProgress >= 1 && !this.clickable;
  }

  hasScored() {
    return this.scored;
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
