import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
} from "@babylonjs/core";

const SPHERE_RADIUS = 300;
const TRAIL_WIDTH = 1.5;
const TILE_WIDTH = 1.5;

const TRAIL_COLOR_NORMAL = new Color3(1, 0.67, 0); // Orange
const TRAIL_EMISSIVE_NORMAL = new Color3(0.5, 0.33, 0);
const TRAIL_COLOR_HIT = new Color3(0, 1, 0); // Green when overlapping tile
const TRAIL_EMISSIVE_HIT = new Color3(0, 0.8, 0);

export class Trail {
  constructor(x, theta, scene, ground) {
    this.scene = scene;
    this.ground = ground;
    this.age = 0;
    this.x = x; // Store x position for overlap checking
    this.mesh = this.createMesh(x, theta);
    this.highlightMesh = null;
    this.isHighlighted = false;
  }

  createMesh(x, theta) {
    const mesh = MeshBuilder.CreatePlane(
      "trail",
      { width: TRAIL_WIDTH, height: 0.4 },
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
    const effectiveRadius = Math.sqrt(SPHERE_RADIUS ** 2 - x ** 2);
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

  setHighlighted(tileX) {
    if (this.isHighlighted) return;
    this.isHighlighted = true;

    // Calculate the overlap region
    const trailLeft = this.x - TRAIL_WIDTH / 2;
    const trailRight = this.x + TRAIL_WIDTH / 2;
    const tileLeft = tileX - TILE_WIDTH / 2;
    const tileRight = tileX + TILE_WIDTH / 2;

    // Find intersection
    const overlapLeft = Math.max(trailLeft, tileLeft);
    const overlapRight = Math.min(trailRight, tileRight);
    const overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth <= 0) return;

    // Create highlight mesh only for the overlapping portion
    this.highlightMesh = MeshBuilder.CreatePlane(
      "trailHighlight",
      { width: overlapWidth, height: 0.4 },
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
  }

  createTrail(x, groundRotation, scene, ground) {
    // Calculate theta based on current ground rotation
    // 90 degrees from current rotation is where the target zone is
    const xOffset = -0.3
    const theta = groundRotation + Math.PI / 2;
    const trail = new Trail(x + xOffset, theta, scene, ground);
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

          const tilePos = tile.mesh.getAbsolutePosition();
          const xDist = Math.abs(trailPos.x - tilePos.x);
          const bounds = tile.getZBounds();

          // Check if trail Z is within tile's front and back edges
          const trailInTile = trailPos.z >= bounds.back && trailPos.z <= bounds.front;

          // Check X overlap: two rectangles overlap if distance < sum of half-widths
          const xOverlap = xDist < (TRAIL_WIDTH + TILE_WIDTH) / 2;

          if (trailInTile && xOverlap) {
            trail.setHighlighted(tilePos.x);
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
  }
}
