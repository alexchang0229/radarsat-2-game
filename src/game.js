import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
} from "@babylonjs/core";
import { TileSpawner } from "./tile.js";

export class Game {
  constructor(scene, camera, engine, ground) {
    this.scene = scene;
    this.camera = camera;
    this.engine = engine;
    this.ground = ground;

    // Game parameters
    this.tileSpeed = 20; // Units per second (linear velocity)
    this.sphereRadius = 300; // Sphere radius
    this.angularVelocity = this.tileSpeed / this.sphereRadius; // Radians per second
    this.bottomThreshold = 8; // Z position where tiles are "missed"

    // Game state
    this.tiles = [];
    this.spawner = new TileSpawner(-50, 1.5, this.tileSpeed); // spawnZ, spawnInterval, tileSpeed
    this.score = 0;
    this.gameOver = false;
    this.isHitting = false; // Track if spacebar is held
    this.currentHitTile = null; // Track which tile is currently being hit

    // Create target zone
    this.targetZone = this.createTargetZone();
    this.targetZPosition = 6; // Z position of target zone near bottom

    // UI elements
    this.scoreElement = document.getElementById("score");
    this.gameOverElement = document.getElementById("gameOver");
    this.finalScoreElement = document.getElementById("finalScore");
    this.restartButton = document.getElementById("restart");

    this.restartButton.addEventListener("click", () => this.restart());

    // Z: along track, X: cross track
    this.zHitRange = 2
    this.xHitRange = 1

    this.BLUE_START = new Color3(0.3, 0.5, 0.9);
    this.GREEN_END = new Color3(0, 1, 0);
  }

  createTargetZone() {
    // Create a thin rectangular target zone (same width as tiles)
    const mesh = MeshBuilder.CreatePlane(
      "targetZone",
      { width: 1.5, height: 0.3 },
      this.scene
    );

    const material = new StandardMaterial("targetZoneMaterial", this.scene);
    material.diffuseColor = new Color3(1, 0.67, 0); // 0xffaa00 orange
    material.emissiveColor = new Color3(0.5, 0.33, 0); // Orange glow
    material.alpha = 0.7;
    material.backFaceCulling = false;
    mesh.material = material;

    mesh.position = new Vector3(0, 0, this.targetZPosition);
    mesh.rotation.x = Math.PI / 2; // Rotate to lie flat
    return mesh;
  }

  update() {
    if (this.gameOver) return;

    const deltaTime = this.engine.getDeltaTime() / 1000; // Convert ms to seconds

    // Rotate the sphere to bring tiles forward (player flying toward tiles)
    this.ground.rotation.x += this.angularVelocity * deltaTime;

    // Spawn new tiles
    const newTile = this.spawner.update(deltaTime, this.scene, this.ground);
    if (newTile) {
      this.tiles.push(newTile);
    }

    // If spacebar is held, check for tile overlaps and update hit progress
    if (this.isHitting) {
      this.updateHitDetection();
    }

    // Check tile positions and update hit progress
    for (let i = this.tiles.length - 1; i >= 0; i--) {
      const tile = this.tiles[i];
      const absolutePos = tile.mesh.getAbsolutePosition();

      // Update hit progress for tiles being hit
      if (tile.isBeingHit) {
        tile.updateHit(deltaTime, this.tileSpeed);
      }

      // Award score when tile is fully hit (only once)
      if (tile.isFullyHit() && !tile.hasScored()) {
        tile.scored = true; // Mark as scored
        this.score++;
        this.updateScore();
      }

      // Check if tile passed bottom (miss condition)
      if (tile.clickable && absolutePos.z > this.bottomThreshold) {
        this.onMiss();
        return;
      }

      // Remove tiles that are too close/behind camera
      if (absolutePos.z > 10) {
        tile.dispose();
        this.tiles.splice(i, 1);
      }
    }
  }

  moveTargetZone(x) {
    // Move target zone horizontally based on mouse position
    // Clamp X position to reasonable bounds
    this.targetZone.position.x = Math.max(-3, Math.min(3, x));
  }

  onHitStart() {
    console.log(this.tiles.slice(-1)[0].mesh.getAbsolutePosition())
    this.isHitting = true;
    // Change target zone to red while hitting
    this.targetZone.material.diffuseColor = new Color3(1, 0, 0);
    this.targetZone.material.emissiveColor = new Color3(0.8, 0, 0);
  }

  onHitEnd() {
    this.isHitting = false;
    // Reset target zone color
    this.targetZone.material.diffuseColor = new Color3(1, 0.67, 0);
    this.targetZone.material.emissiveColor = new Color3(0.5, 0.33, 0);

    // Stop hitting all tiles
    for (const tile of this.tiles) {
      if (tile.isBeingHit) {
        tile.stopHit();
      }
    }
    this.currentHitTile = null;
  }

  updateHitDetection() {
    // If we are already hitting a tile, keep hitting it
    if (this.currentHitTile) {
      return;
    }

    // Look for a new tile to start hitting
    for (const tile of this.tiles) {
      if (!tile.clickable || tile.scored) continue;

      const absolutePos = tile.mesh.getAbsolutePosition();
      const xDist = Math.abs(absolutePos.x - this.targetZone.position.x);

      // Get tile's Z bounds (front = closer to camera, back = farther)
      const bounds = tile.getZBounds();
      // Check if target zone Z is within tile's front and back edges (with tolerance)
      const targetInTile = bounds.back <= 0 &&
        bounds.front >= 0;

      // Must be in the Z-range AND the correct X-column
      if (targetInTile && xDist < this.xHitRange) {
        this.currentHitTile = tile;
        if (!this.currentHitTile.isBeingHit) {
          this.currentHitTile.startHit();
        }
        break;
      }
    }
  }

  updateScore() {
    this.scoreElement.textContent = `Score: ${this.score}`;
  }

  onMiss() {
    // this.gameOver = true;
    // this.finalScoreElement.textContent = this.score;
    // this.gameOverElement.classList.remove("hidden");
  }

  restart() {
    // Remove all tiles from scene
    this.tiles.forEach((tile) => {
      tile.dispose();
    });
    this.tiles = [];

    // Reset game state
    this.score = 0;
    this.gameOver = false;
    this.isHitting = false;
    this.currentHitTile = null;
    this.updateScore();
    this.gameOverElement.classList.add("hidden");

    // Reset target zone position and color
    this.targetZone.position.x = 0;
    this.targetZone.material.diffuseColor = new Color3(1, 0.67, 0);
    this.targetZone.material.emissiveColor = new Color3(0.5, 0.33, 0);

    // Reset sphere rotation
    this.ground.rotation.x = 0;

    // Reset spawner
    this.spawner.reset();
  }

  getTargetZone() {
    return this.targetZone;
  }
}
