import {
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
} from "@babylonjs/core";

const SPHERE_RADIUS = 300;

export class Trail {
  constructor(x, theta, scene, ground) {
    this.scene = scene;
    this.ground = ground;
    this.age = 0;
    this.mesh = this.createMesh(x, theta);
  }

  createMesh(x, theta) {
    const mesh = MeshBuilder.CreatePlane(
      "trail",
      { width: 1.5, height: 0.3 },
      this.scene
    );

    const material = new StandardMaterial("trailMaterial", this.scene);
    material.diffuseColor = new Color3(1, 0.67, 0); // 0xffaa00 orange
    material.emissiveColor = new Color3(0.5, 0.33, 0); // Orange glow
    material.alpha = 0.7;
    material.backFaceCulling = false;
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

  updateAge(deltaTime) {
    this.age += deltaTime;
  }

  dispose() {
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

  update(deltaTime, angularVelocity) {
    // Update trail ages and remove old ones
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const trail = this.trails[i];
      trail.updateAge(deltaTime);

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
