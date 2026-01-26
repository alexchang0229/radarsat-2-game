import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
} from "@babylonjs/core";

const SATELLITE_POS = new Vector3(0, 6, 0);
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

    // Game state
    this.tiles = [];
    this.spawner = new TileSpawner(this.angularVelocity);
    this.trailSpawner = new TrailSpawner();
    this.score = 0;
    this.lives = 3;
    this.gameOver = false;
    this.isHitting = false;
    this.paused = false;

    // Target zone width tracking
    this.targetWidthIndex = 0; // Default to first width (key A)
    this.targetWidth = TILE_WIDTHS[this.targetWidthIndex];

    // Create target zone and beam lines
    this.targetZone = this.createTargetZone();
    this.beamLines = this.createBeamLines();

    // UI elements
    this.scoreElement = document.getElementById("score");
    this.livesElement = document.getElementById("lives");
    this.gameOverElement = document.getElementById("gameOver");
    this.finalScoreElement = document.getElementById("finalScore");
    this.finalHighScoreElement = document.getElementById("finalHighScore");
    this.restartButton = document.getElementById("restart");
    this.hudElement = document.getElementById("hud");

    // Session high score
    this.highScore = 0;

    this.restartButton.addEventListener("click", () => this.restart());

    // GUI for percentage flashes
    this.guiTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene);
    this.activeFlashes = []; // Track active flash animations

    // Legend items for highlighting and clicking
    this.legendItems = document.querySelectorAll('.legend-item');
    this.legendItems.forEach((item) => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        this.setTargetWidthIndex(index);
      });
    });
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

  createBeamLines() {
    const halfWidth = this.targetWidth / 2;
    const leftStart = new Vector3(this.targetZone.position.x - halfWidth, HEIGHT_OFFSET, 0);
    const rightStart = new Vector3(this.targetZone.position.x + halfWidth, HEIGHT_OFFSET, 0);

    const leftLine = MeshBuilder.CreateLines("beamLeft", {
      points: [leftStart, SATELLITE_POS],
      updatable: true,
    }, this.scene);
    leftLine.color = new Color3(1, 1, 1);
    leftLine.alpha = 0.1

    const rightLine = MeshBuilder.CreateLines("beamRight", {
      points: [rightStart, SATELLITE_POS],
      updatable: true,
    }, this.scene);
    rightLine.color = new Color3(1, 1, 1);
    rightLine.alpha = 0.1

    return { leftLine, rightLine };
  }

  updateBeamLines() {
    if (!this.beamLines) return;
    const halfWidth = this.targetWidth / 2;
    const leftStart = new Vector3(this.targetZone.position.x - halfWidth, HEIGHT_OFFSET, 0);
    const rightStart = new Vector3(this.targetZone.position.x + halfWidth, HEIGHT_OFFSET, 0);

    this.beamLines.leftLine = MeshBuilder.CreateLines("beamLeft", {
      points: [leftStart, SATELLITE_POS],
      instance: this.beamLines.leftLine,
    });

    this.beamLines.rightLine = MeshBuilder.CreateLines("beamRight", {
      points: [rightStart, SATELLITE_POS],
      instance: this.beamLines.rightLine,
    });
  }

  update() {
    const deltaTime = this.engine.getDeltaTime() / 1000; // Convert ms to seconds

    // Rotate the Earth texture even when paused/game over (for menu ambiance)
    if (this.earthTexture) {
      this.earthTexture.uOffset += EARTH_TEXTURE_ROTATE_SPEED * deltaTime;
    }

    this.ground.rotation.x += this.angularVelocity * deltaTime;

    if (this.gameOver || this.paused) return;


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
        const percent = tile.getCoveragePercent();
        this.showPercentageFlash(tile, percent);
        this.score += Math.round(percent);
        this.updateScore();

        if (percent < 50) {
          this.lives--;
          this.updateLives();
          if (this.lives <= 0) {
            this.triggerGameOver();
          }
        }
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
    this.updateBeamLines();
  }

  onHitStart() {
    this.isHitting = true;
    // Start trail spawning at current position
    this.trailSpawner.startSpawning(this.targetZone.position.x, this.targetWidthIndex, this.ground.rotation.x);
    // Brighten target zone color while hitting (same hue, more intense)
    const color = WIDTH_COLORS[this.targetWidthIndex];
    this.targetZone.material.diffuseColor = new Color3(color.r, color.g, color.b);
    this.targetZone.material.emissiveColor = new Color3(color.r, color.g, color.b);
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
    const screenPos = Vector3.Project(
      tilePos,
      this.scene.getTransformMatrix(),
      this.scene.getTransformMatrix(),
      this.camera.viewport.toGlobal(this.engine.getRenderWidth(), this.engine.getRenderHeight())
    );
    const left = screenPos.x - this.engine.getRenderWidth() / 2;
    const top = screenPos.y - this.engine.getRenderHeight() / 2;

    const textBlock = new TextBlock();
    textBlock.text = `${Math.round(percent)}%`;
    textBlock.color = percent >= 80 ? "lime" : percent >= 50 ? "yellow" : "red";
    textBlock.fontSize = 48;
    textBlock.fontWeight = "bold";
    textBlock.outlineWidth = 2;
    textBlock.outlineColor = "black";
    textBlock.left = left;
    textBlock.top = top;
    this.guiTexture.addControl(textBlock);
    this.activeFlashes.push({ textBlock, age: 0, duration: 1.0 });

    if (percent < 50) {
      const lossText = new TextBlock();
      lossText.text = "DATA LOSS +1";
      lossText.color = "#ff4444";
      lossText.fontSize = 28;
      lossText.fontWeight = "bold";
      lossText.outlineWidth = 2;
      lossText.outlineColor = "black";
      lossText.left = left;
      lossText.top = top + 50;
      this.guiTexture.addControl(lossText);
      this.activeFlashes.push({ textBlock: lossText, age: 0, duration: 1.5 });
    }
  }

  updateFlashes(deltaTime) {
    for (let i = this.activeFlashes.length - 1; i >= 0; i--) {
      const flash = this.activeFlashes[i];
      flash.age += deltaTime;
      const progress = flash.age / flash.duration;
      flash.textBlock.alpha = 1 - progress;

      if (flash.age >= flash.duration) {
        this.guiTexture.removeControl(flash.textBlock);
        this.activeFlashes.splice(i, 1);
      }
    }
  }

  updateScore() {
    this.scoreElement.textContent = `Score: ${this.score}`;
    if (this.score > this.highScore) {
      this.highScore = this.score;
    }
  }

  updateLives() {
    this.livesElement.textContent = `Data Loss Reports: ${3 - this.lives}/3`;
  }

  triggerGameOver() {
    this.gameOver = true;
    this.finalScoreElement.textContent = this.score;
    this.finalHighScoreElement.textContent = this.highScore;
    this.gameOverElement.classList.remove("hidden");
    this.setTargetVisible(false);
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
    this.lives = 3;
    this.gameOver = false;
    this.isHitting = false;
    this.paused = false;
    this.updateScore();
    this.updateLives();
    this.gameOverElement.classList.add("hidden");
    this.hudElement.classList.remove("hidden");

    // Reset target zone width, position and color
    this.targetWidthIndex = 0;
    this.targetWidth = TILE_WIDTHS[0];
    this.targetZone.dispose();
    this.targetZone = this.createTargetZone();
    this.targetZone.position.x = 0;

    // Recreate beam lines
    this.beamLines.leftLine.dispose();
    this.beamLines.rightLine.dispose();
    this.beamLines = this.createBeamLines();

    // Show target zone and beam lines
    this.setTargetVisible(true);

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
    if (this.isHitting) return; // Cannot switch beams while hitting
    this.targetWidthIndex = index;
    this.targetWidth = TILE_WIDTHS[index];

    // Recreate target zone mesh with new width
    const oldX = this.targetZone.position.x;
    this.targetZone.dispose();
    this.targetZone = this.createTargetZone();
    this.targetZone.position.x = oldX;

    // Update beam lines for new width
    this.updateBeamLines();

    // Update legend highlight
    this.updateLegendHighlight();
  }

  updateLegendHighlight() {
    this.legendItems.forEach((item, i) => {
      item.classList.toggle('active', i === this.targetWidthIndex);
    });
  }

  getTargetWidthIndex() {
    return this.targetWidthIndex;
  }

  setPaused(paused) {
    this.paused = paused;
  }

  setTargetVisible(visible) {
    this.targetZone.setEnabled(visible);
    this.beamLines.leftLine.setEnabled(visible);
    this.beamLines.rightLine.setEnabled(visible);
  }

  startGame() {
    this.spawner.syncToRotation(this.ground.rotation.x);
    this.setPaused(false);
  }
}
