import {
  MeshBuilder,
  Color3,
  Vector3,
} from "@babylonjs/core";
import { SPHERE_RADIUS, HEIGHT_OFFSET, TILE_WIDTHS, WIDTH_COLORS } from "./config.js";

const COLUMN_POSITIONS = [-2.25, -0.75, 0.75, 2.25];

export class Tile {
  constructor(column, spawnTheta, scene, ground) {
    this.column = column;
    this.clickable = true;
    this.ground = ground;
    this.widthIndex = Math.floor(Math.random() * TILE_WIDTHS.length);
    this.TILE_WIDTH = TILE_WIDTHS[this.widthIndex];
    this.TILE_DEPTH = 2 + Math.random() * 4;
    this.mesh = this.createMesh(column, spawnTheta, scene);
    this.age = 0;
    this.totalCoverageArea = 0;
    this.tileArea = this.TILE_WIDTH * this.TILE_DEPTH;
    this.hasPassedTarget = false;
    this.coveragePercent = 0;
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

  addTrailCoverage(trailX, trailWidth, trailHeight) {
    if (this.hasPassedTarget) return;
    const tileXBounds = this.getXBounds();
    const overlapWidth = Math.max(0,
      Math.min(tileXBounds.right, trailX + trailWidth / 2) -
      Math.max(tileXBounds.left, trailX - trailWidth / 2)
    );
    if (overlapWidth > 0) {
      this.totalCoverageArea += overlapWidth * trailHeight;
    }
  }

  checkPassedTarget() {
    if (this.hasPassedTarget) return false;
    if (this.getZBounds().back > 0) {
      this.hasPassedTarget = true;
      this.clickable = false;
      this.coveragePercent = Math.min(100, (this.totalCoverageArea / this.tileArea) * 100);
      return true;
    }
    return false;
  }

  getCoveragePercent() {
    return this.coveragePercent;
  }

  createMesh(column, spawnTheta, scene) {
    const halfWidth = this.TILE_WIDTH / 2;
    const halfDepth = this.TILE_DEPTH / 2;
    const points = [
      new Vector3(-halfWidth, -halfDepth, 0),
      new Vector3(halfWidth, -halfDepth, 0),
      new Vector3(halfWidth, halfDepth, 0),
      new Vector3(-halfWidth, halfDepth, 0),
      new Vector3(-halfWidth, -halfDepth, 0),
    ];

    const mesh = MeshBuilder.CreateLines("tile", { points }, scene);
    const color = WIDTH_COLORS[this.widthIndex];
    mesh.color = new Color3(color.r, color.g, color.b);

    const x = COLUMN_POSITIONS[column];
    const theta = spawnTheta + 120 * Math.PI / 180;
    const effectiveRadius = Math.sqrt(SPHERE_RADIUS ** 2 - x ** 2) + HEIGHT_OFFSET;
    mesh.position = new Vector3(x, effectiveRadius * Math.sin(theta), effectiveRadius * Math.cos(theta));
    mesh.rotation.x = -theta;
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
  constructor(angularVelocity = 0.0167) {
    this.currentSpawnTheta = 0;
    this.angularVelocity = angularVelocity; // Radians per second (matches sphere rotation)
    this.timeSinceLastSpawn = 0;
    this.gameTime = 0; // Track total game time for difficulty progression
    this.startInterval = 5; // Starting spawn interval (easy)
    this.minInterval = 1; // Minimum spawn interval (hard)
    this.rampDuration = 120; // Time in seconds to reach minimum interval
  }

  getSpawnInterval() {
    // Linearly interpolate from startInterval to minInterval over rampDuration
    const progress = Math.min(this.gameTime / this.rampDuration, 1);
    return this.startInterval - (this.startInterval - this.minInterval) * progress;
  }

  update(deltaTime, scene, ground) {
    this.gameTime += deltaTime;
    this.timeSinceLastSpawn += deltaTime;

    const currentInterval = this.getSpawnInterval();

    if (this.timeSinceLastSpawn >= currentInterval) {
      this.timeSinceLastSpawn = 0;

      // Spawn tile at current theta position
      const tile = this.spawnTile(scene, ground);

      // Move spawn angle further ahead for next tile
      // Angular distance = angular velocity × time between spawns
      this.currentSpawnTheta += this.angularVelocity * currentInterval;

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
    this.gameTime = 0;
  }

  syncToRotation(groundRotationX) {
    this.currentSpawnTheta = groundRotationX;
  }
}
