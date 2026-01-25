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
  SceneLoader,
} from '@babylonjs/core';
import '@babylonjs/loaders/OBJ';
import earthTextureUrl from './Earth.jpg';


export async function createScene(canvas) {
  // Create engine and scene
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.clearColor = new Color3(0.02, 0.02, 0.05); // Dark space background

  // Camera - positioned to look down the track for vanishing point effect
  const camera = new FreeCamera('camera', new Vector3(10, 10, 10), scene);
  camera.setTarget(new Vector3(0, 0, -5));
  camera.fov = 0.9; // ~50 degrees in radians

  // Lighting
  const ambientLight = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
  ambientLight.intensity = 0.02; // Very low ambient for darker shadows
  ambientLight.groundColor = new Color3(0, 0, 0); // No ground bounce light

  // Light direction points FROM the light source, so (-1, -0.5, 0.5) means light comes from upper-right
  const directionalLight = new DirectionalLight('directional', new Vector3(-1, -.1, 0), scene);
  directionalLight.intensity = 1.5; // Brighter sun for more contrast

  // Create starfield skybox
  createStarfield(scene);

  // Track visualization
  const { ground, earthTexture } = createTrack(scene);

  // Load RADARSAT-2 satellite model and apply rotation
  loadR2Model(scene);

  // Handle window resize
  window.addEventListener('resize', () => {
    engine.resize();
  });

  return { scene, camera, engine, ground, earthTexture };
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
  const earthTexture = new Texture(earthTextureUrl, scene);

  const groundMaterial = new StandardMaterial('groundMaterial', scene);
  groundMaterial.diffuseTexture = earthTexture;
  groundMaterial.diffuseColor = new Color3(5, 5, 5); // Boost lit areas
  ground.material = groundMaterial;

  return { ground, earthTexture };
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

async function loadR2Model(scene) {
  try {
    const result = await SceneLoader.ImportMeshAsync('', '/', 'R2.obj', scene);
    const meshes = result.meshes;

    if (meshes.length > 0) {
      const root = meshes[0];
      const basePosition = new Vector3(0, 6, 0); // Store the starting position

      root.position = basePosition.clone();
      // Position the satellite near the camera view
      root.position = new Vector3(0, 6, 0);
      // Scale the model (adjust as needed based on model size)
      root.scaling = new Vector3(0.0001, 0.0001, 0.0001);
      // Apply rotation and bake it into vertices so normals stay correct for lighting
      root.rotation.x = -Math.PI / 2 + 30 * Math.PI / 180;
      root.rotation.y = Math.PI / 2;

      let time = 0;
      const amplitude = 0.12; // How far up/down it moves
      const rotationAmplitude = 0.0001
      const frequency = 0.015; // How fast it bobs

      scene.onBeforeRenderObservable.add(() => {
        time += frequency;
        // Apply sine wave to the Y axis relative to the base position
        root.position.y = basePosition.y + Math.sin(time) * amplitude;

        root.rotation.z += Math.cos(time * 0.5) * rotationAmplitude;
      });
      meshes.forEach(mesh => {
        if (mesh.material) {
          mesh.createNormals(true);
        }
      });
    }
  } catch (error) {
    console.error('Failed to load R2 model:', error);
  }
  return null;
}

