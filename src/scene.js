import {
  Engine,
  Scene,
  FreeCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  Color3,
  MeshBuilder,
  StandardMaterial,
  Texture,
  ParticleSystem
} from '@babylonjs/core';

export function createScene(canvas) {
  // Create engine and scene
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.clearColor = new Color3(0.02, 0.02, 0.05); // Dark space background

  // Camera - positioned to look down the track for vanishing point effect
  const camera = new FreeCamera('camera', new Vector3(40, 20, 20), scene);
  camera.setTarget(new Vector3(0, 0, -5));
  camera.fov = 1.0; // ~50 degrees in radians

  // Lighting
  const ambientLight = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
  ambientLight.intensity = 0.6;

  const directionalLight = new DirectionalLight('directional', new Vector3(-1, -1, -1), scene);
  directionalLight.position = new Vector3(5, 5, 5);
  directionalLight.intensity = 0.4;

  // Create starfield skybox
  createStarfield(scene);

  // Track visualization
  const ground = createTrack(scene);

  // Handle window resize
  window.addEventListener('resize', () => {
    engine.resize();
  });

  return { scene, camera, engine, ground };
}

function createTrack(scene) {
  // Create a large sphere for curved ground
  const sphereRadius = 300; // Large radius for subtle curvature
  const ground = MeshBuilder.CreateSphere('ground', {
    diameter: sphereRadius * 2,
    segments: 64
  }, scene);

  // Position sphere so the top surface is at y = -0.5
  ground.position.y = -sphereRadius - 0.5;

  const groundMaterial = new StandardMaterial('groundMaterial', scene);
  groundMaterial.diffuseColor = new Color3(0.2, 0.2, 0.2);
  groundMaterial.specularColor = new Color3(0, 0, 0);
  groundMaterial.wireframe = true; // Show wireframe to emphasize sphere shape
  ground.material = groundMaterial;

  // Lane dividers (between the 4 columns)
  const dividerMaterial = new StandardMaterial('dividerMaterial', scene);
  dividerMaterial.diffuseColor = new Color3(0.27, 0.27, 0.27);
  dividerMaterial.alpha = 0.5;

  const dividerPositions = [-1.5, 0, 1.5]; // Between 4 columns

  // Create curved dividers using cylinders positioned on the sphere surface
  dividerPositions.forEach(x => {
    // Create a tall thin cylinder for each divider
    const divider = MeshBuilder.CreateCylinder('divider', {
      height: 100,
      diameter: 0.05,
      tessellation: 8
    }, scene);

    // Calculate the Y position on the sphere surface at this X position
    // For a sphere: x² + y² + z² = r²
    // Position divider along the track centerline (z = -25)
    const zPos = -25;
    const distFromCenter = Math.sqrt(x * x + zPos * zPos);
    const yOffset = Math.sqrt(Math.max(0, sphereRadius * sphereRadius - distFromCenter * distFromCenter));

    // Parent divider to ground sphere first so position is in local coordinates
    divider.parent = ground;

    // Set position in sphere's local coordinate system
    divider.position.set(x, yOffset - 50, zPos);
    divider.material = dividerMaterial;

    // Rotate divider to align with sphere surface
    const angle = Math.atan2(x, sphereRadius);
    divider.rotation.z = -angle;
  });

  return ground;
}

function createStarfield(scene) {
  // Create a large inverted sphere for the skybox
  const starSphere = MeshBuilder.CreateSphere('starfield', {
    diameter: 2000,
    segments: 32
  }, scene);

  const starMaterial = new StandardMaterial('starMaterial', scene);
  starMaterial.diffuseColor = new Color3(0, 0, 0);
  starMaterial.emissiveColor = new Color3(0.05, 0.05, 0.1); // Slight dark blue glow
  starMaterial.backFaceCulling = false;
  starMaterial.disableLighting = true;

  starSphere.material = starMaterial;
  starSphere.infiniteDistance = true; // Always stays at horizon

  // Add random stars as small glowing spheres
  const starCount = 2000;
  for (let i = 0; i < starCount; i++) {
    // Random position on sphere surface
    const theta = Math.random() * Math.PI * 2; // Azimuth
    const phi = Math.acos(2 * Math.random() - 1); // Elevation
    const radius = 950; // Just inside the skybox

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    // Create stars with varied sizes - some larger, some smaller
    const starSize = Math.random() * 2.5 + 0.8; // 0.8 to 3.3 units
    const star = MeshBuilder.CreateSphere(`star${i}`, {
      diameter: starSize,
      segments: 6
    }, scene);

    star.position.set(x, y, z);

    const starMatInstance = new StandardMaterial(`starMat${i}`, scene);
    // Brighter stars with full intensity
    const brightness = Math.random() * 0.3 + 0.7; // 0.7 to 1.0
    // Some stars with slight color variation
    const colorVariation = Math.random();
    if (colorVariation > 0.95) {
      // Rare blue-white stars
      starMatInstance.emissiveColor = new Color3(brightness * 0.9, brightness * 0.95, brightness);
    } else if (colorVariation > 0.90) {
      // Rare yellow-orange stars
      starMatInstance.emissiveColor = new Color3(brightness, brightness * 0.9, brightness * 0.7);
    } else {
      // Most stars are white
      starMatInstance.emissiveColor = new Color3(brightness, brightness, brightness * 0.98);
    }
    starMatInstance.disableLighting = true;
    star.material = starMatInstance;
  }
}

