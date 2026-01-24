import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
} from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";
import { TileSpawner } from "./tile.js";
import { TrailSpawner } from "./trail.js";
import { HEIGHT_OFFSET } from "./config.js";

export class Game {
  constructor(scene, camera, engine, ground) {
    this.scene = scene;
    this.camera = camera;
    this.engine = engine;
    this.ground = ground;

    // Game parameters
    this.tileSpeed = 10; // Units per second (linear velocity)
    this.sphereRadius = 300; // Sphere radius
    this.angularVelocity = this.tileSpeed / this.sphereRadius; // Radians per second
    this.bottomThreshold = 8; // Z position where tiles are "missed"

    // Game state
    this.tiles = [];
    this.spawner = new TileSpawner(1.5, this.angularVelocity);
    this.trailSpawner = new TrailSpawner();
    this.score = 0;
    this.gameOver = false;
    this.isHitting = false; // Track if spacebar is held

    // Create target zone
    this.targetZone = this.createTargetZone();
    this.targetZPosition = 6; // Z position of target zone near bottom

    // UI elements
    this.scoreElement = document.getElementById("score");
    this.gameOverElement = document.getElementById("gameOver");
    this.finalScoreElement = document.getElementById("finalScore");
    this.restartButton = document.getElementById("restart");

    this.restartButton.addEventListener("click", () => this.restart());

    // GUI for percentage flashes
    this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene);
    this.activeFlashes = []; // Track active flash animations
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

    mesh.position = new Vector3(0, HEIGHT_OFFSET, this.targetZPosition);
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

    // If spacebar is held, create trails
    if (this.isHitting) {
      this.trailSpawner.createTrail(this.targetZone.position.x, this.ground.rotation.x, this.scene, this.ground);
    }

    // Update trails (removes old ones, highlights overlapping with tiles, adds coverage)
    this.trailSpawner.update(deltaTime, this.angularVelocity, this.tiles);

    // Update flash animations
    this.updateFlashes(deltaTime);

    // Check tile positions and coverage
    for (let i = this.tiles.length - 1; i >= 0; i--) {
      const tile = this.tiles[i];

      // Update tile age
      tile.updateAge(deltaTime);

      // Check if tile just passed the target zone
      if (tile.checkPassedTarget()) {
        // Tile just passed - show percentage flash
        const percent = tile.getCoveragePercent();
        this.showPercentageFlash(tile, percent);

        // Add to score based on coverage
        this.score += Math.round(percent);
        this.updateScore();
      }

      // Remove tiles after they've rotated 30 degrees (based on age and rotation rate)
      const rotationAngleDegrees = (tile.age * this.angularVelocity * 180) / Math.PI;
      if (rotationAngleDegrees > 30) {
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
  }

  showPercentageFlash(tile, percent) {
    const tilePos = tile.mesh.getAbsolutePosition();

    // Create text block for the percentage
    const textBlock = new TextBlock();
    textBlock.text = `${Math.round(percent)}%`;
    textBlock.color = percent >= 80 ? "lime" : percent >= 50 ? "yellow" : "red";
    textBlock.fontSize = 48;
    textBlock.fontWeight = "bold";
    textBlock.outlineWidth = 2;
    textBlock.outlineColor = "black";

    this.guiTexture.addControl(textBlock);

    // Convert 3D position to screen position
    const screenPos = Vector3.Project(
      tilePos,
      this.scene.getTransformMatrix(),
      this.scene.getTransformMatrix(),
      this.camera.viewport.toGlobal(
        this.engine.getRenderWidth(),
        this.engine.getRenderHeight()
      )
    );

    // Position the text (GUI uses -1 to 1 coordinates from center)
    textBlock.left = screenPos.x - this.engine.getRenderWidth() / 2;
    textBlock.top = screenPos.y - this.engine.getRenderHeight() / 2;

    // Track this flash for animation
    this.activeFlashes.push({
      textBlock,
      age: 0,
      duration: 1.0, // Flash lasts 1 second
      startY: textBlock.top
    });
  }

  updateFlashes(deltaTime) {
    for (let i = this.activeFlashes.length - 1; i >= 0; i--) {
      const flash = this.activeFlashes[i];
      flash.age += deltaTime;

      // Animate: float upward and fade out
      const progress = flash.age / flash.duration;
      flash.textBlock.top = flash.startY// Float up 50 pixels
      flash.textBlock.alpha = 1 - progress; // Fade out

      // Remove when done
      if (flash.age >= flash.duration) {
        this.guiTexture.removeControl(flash.textBlock);
        this.activeFlashes.splice(i, 1);
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

    // Clear any active flashes
    for (const flash of this.activeFlashes) {
      this.guiTexture.removeControl(flash.textBlock);
    }
    this.activeFlashes = [];

    // Reset game state
    this.score = 0;
    this.gameOver = false;
    this.isHitting = false;
    this.updateScore();
    this.gameOverElement.classList.add("hidden");

    // Reset target zone position and color
    this.targetZone.position.x = 0;
    this.targetZone.material.diffuseColor = new Color3(1, 0.67, 0);
    this.targetZone.material.emissiveColor = new Color3(0.5, 0.33, 0);

    // Reset sphere rotation
    this.ground.rotation.x = 0;

    // Reset spawners
    this.spawner.reset();
    this.trailSpawner.reset();
  }

  getTargetZone() {
    return this.targetZone;
  }
}
