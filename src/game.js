import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
} from "@babylonjs/core";
import { AdvancedDynamicTexture, TextBlock } from "@babylonjs/gui";
import { TileSpawner } from "./tile.js";
import { TrailSpawner } from "./trail.js";
import { HEIGHT_OFFSET, TILE_WIDTHS, WIDTH_COLORS, EARTH_TEXTURE_ROTATE_SPEED } from "./config.js";

export class Game {
  constructor(scene, camera, engine, ground, earthTexture) {
    this.scene = scene;
    this.camera = camera;
    this.engine = engine;
    this.ground = ground;
    this.earthTexture = earthTexture;

    // Game parameters
    this.tileSpeed = 10; // Units per second (linear velocity)
    this.sphereRadius = 300; // Sphere radius
    this.angularVelocity = this.tileSpeed / this.sphereRadius; // Radians per second
    this.bottomThreshold = 8; // Z position where tiles are "missed"

    // Game state
    this.tiles = [];
    this.spawner = new TileSpawner(this.angularVelocity);
    this.trailSpawner = new TrailSpawner();
    this.score = 0;
    this.gameOver = false;
    this.isHitting = false; // Track if spacebar is held

    // Target zone width tracking
    this.targetWidthIndex = 0; // Default to first width (key A)
    this.targetWidth = TILE_WIDTHS[this.targetWidthIndex];

    // Create target zone
    this.targetZone = this.createTargetZone();

    // UI elements
    this.scoreElement = document.getElementById("score");
    this.gameOverElement = document.getElementById("gameOver");
    this.finalScoreElement = document.getElementById("finalScore");
    this.restartButton = document.getElementById("restart");

    this.restartButton.addEventListener("click", () => this.restart());

    // GUI for percentage flashes
    this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene);
    this.activeFlashes = []; // Track active flash animations

    // Legend items for highlighting
    this.legendItems = document.querySelectorAll('.legend-item');
    this.updateLegendHighlight();
  }

  createTargetZone() {
    // Create a thin rectangular target zone with current width
    const mesh = MeshBuilder.CreatePlane(
      "targetZone",
      { width: this.targetWidth, height: 0.3 },
      this.scene
    );

    // Color based on current width index
    const color = WIDTH_COLORS[this.targetWidthIndex];
    const material = new StandardMaterial("targetZoneMaterial", this.scene);
    material.diffuseColor = new Color3(color.r, color.g, color.b);
    material.emissiveColor = new Color3(color.r * 0.5, color.g * 0.5, color.b * 0.5);
    material.alpha = 0.7;
    material.backFaceCulling = false;
    mesh.material = material;

    mesh.position = new Vector3(0, HEIGHT_OFFSET, 0);
    mesh.rotation.x = Math.PI / 2; // Rotate to lie flat
    return mesh;
  }

  update() {
    if (this.gameOver) return;
    const deltaTime = this.engine.getDeltaTime() / 1000; // Convert ms to seconds

    // Rotate the sphere to bring tiles forward (player flying toward tiles)
    this.ground.rotation.x += this.angularVelocity * deltaTime;

    // Rotate the Earth texture
    if (this.earthTexture) {
      this.earthTexture.uOffset += EARTH_TEXTURE_ROTATE_SPEED * deltaTime;
    }

    // Spawn new tiles
    const newTile = this.spawner.update(deltaTime, this.scene, this.ground);
    if (newTile) {
      this.tiles.push(newTile);
    }

    // Update trail spawn position if currently spawning
    if (this.isHitting) {
      this.trailSpawner.updateSpawnPosition(this.targetZone.position.x, this.targetWidthIndex);
    }

    // Spawn trails based on rotation (fills gaps regardless of frame rate)
    this.trailSpawner.spawnTrails(this.ground.rotation.x, this.scene, this.ground);

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
    // Start trail spawning at current position
    this.trailSpawner.startSpawning(this.targetZone.position.x, this.targetWidthIndex, this.ground.rotation.x);
    // Change target zone to red while hitting
    this.targetZone.material.diffuseColor = new Color3(1, 0, 0);
    this.targetZone.material.emissiveColor = new Color3(0.8, 0, 0);
  }

  onHitEnd() {
    this.isHitting = false;
    // Stop trail spawning
    this.trailSpawner.stopSpawning();
    // Reset target zone to its width color
    const color = WIDTH_COLORS[this.targetWidthIndex];
    this.targetZone.material.diffuseColor = new Color3(color.r, color.g, color.b);
    this.targetZone.material.emissiveColor = new Color3(color.r * 0.5, color.g * 0.5, color.b * 0.5);
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

    // Reset target zone width, position and color
    this.targetWidthIndex = 0;
    this.targetWidth = TILE_WIDTHS[0];
    this.targetZone.dispose();
    this.targetZone = this.createTargetZone();
    this.targetZone.position.x = 0;
    this.updateLegendHighlight();

    // Reset sphere rotation
    this.ground.rotation.x = 0;

    // Reset spawners
    this.spawner.reset();
    this.trailSpawner.reset();
  }

  getTargetZone() {
    return this.targetZone;
  }

  setTargetWidthIndex(index) {
    if (index < 0 || index >= TILE_WIDTHS.length) return;
    this.targetWidthIndex = index;
    this.targetWidth = TILE_WIDTHS[index];

    // Recreate target zone mesh with new width
    const oldX = this.targetZone.position.x;
    this.targetZone.dispose();
    this.targetZone = this.createTargetZone();
    this.targetZone.position.x = oldX;

    // If currently hitting, keep the red color
    if (this.isHitting) {
      this.targetZone.material.diffuseColor = new Color3(1, 0, 0);
      this.targetZone.material.emissiveColor = new Color3(0.8, 0, 0);
    }

    // Update legend highlight
    this.updateLegendHighlight();
  }

  updateLegendHighlight() {
    this.legendItems.forEach((item, i) => {
      if (i === this.targetWidthIndex) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  getTargetWidthIndex() {
    return this.targetWidthIndex;
  }
}
