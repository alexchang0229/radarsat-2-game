import {
  Engine,
  Scene,
  FreeCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  Color3,
  Color4,
  MeshBuilder,
  StandardMaterial,
  Texture,
  SceneLoader,
  GlowLayer,
  Matrix,
} from '@babylonjs/core';
import '@babylonjs/loaders/OBJ';
import earthTextureUrl from './Earth.jpg';


export async function createScene(canvas) {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.clearColor = new Color3(0.02, 0.02, 0.05);

  const camera = new FreeCamera('camera', new Vector3(10, 10, 10), scene);
  camera.setTarget(new Vector3(0, 0, -5));
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth <= 768;
  camera.fov = isMobile ? 1.5 : 0.9;

  const ambientLight = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
  ambientLight.intensity = 0.02;
  ambientLight.groundColor = new Color3(0, 0, 0);

  const directionalLight = new DirectionalLight('directional', new Vector3(-1, -0.1, 0), scene);
  directionalLight.intensity = 1.5;

  const { ground, earthTexture } = createTrack(scene);
  createStarfield(scene, ground);
  loadR2Model(scene);

  window.addEventListener('resize', () => engine.resize());

  return { scene, camera, engine, ground, earthTexture };
}

function createTrack(scene) {
  const sphereRadius = 300;
  const ground = MeshBuilder.CreateSphere('ground', { diameter: sphereRadius * 2, segments: 64 }, scene);
  ground.position.y = -sphereRadius - 0.5;

  const earthTexture = new Texture(earthTextureUrl, scene);
  const groundMaterial = new StandardMaterial('groundMaterial', scene);
  groundMaterial.diffuseTexture = earthTexture;
  groundMaterial.diffuseColor = new Color3(5, 5, 5);
  ground.material = groundMaterial;

  // Add atmospheric haze around the globe
  createAtmosphere(scene, ground, sphereRadius);

  return { ground, earthTexture };
}

function createAtmosphere(scene, ground, sphereRadius) {
  // Create a slightly larger sphere for the atmosphere
  // Using lower segment count - these are translucent background effects
  const atmosphereRadius = sphereRadius * 1.01;
  const atmosphere = MeshBuilder.CreateSphere('atmosphere', {
    diameter: atmosphereRadius * 2,
    segments: 24  // Reduced from 64 - sufficient for translucent effect
  }, scene);
  atmosphere.position.y = ground.position.y;

  // Atmosphere material - bluish glow with transparency
  const atmosphereMaterial = new StandardMaterial('atmosphereMaterial', scene);
  atmosphereMaterial.diffuseColor = new Color3(0.3, 0.5, 0.9);
  atmosphereMaterial.emissiveColor = new Color3(0.1, 0.2, 0.4);
  atmosphereMaterial.alpha = 0.15;
  atmosphereMaterial.backFaceCulling = true;
  atmosphereMaterial.disableLighting = true;
  atmosphere.material = atmosphereMaterial;

  // Create outer haze layer for more depth
  const outerHaze = MeshBuilder.CreateSphere('outerHaze', {
    diameter: sphereRadius * 1.08,
    segments: 16  // Reduced from 32 - sufficient for translucent haze
  }, scene);
  outerHaze.position.y = ground.position.y;

  const outerHazeMaterial = new StandardMaterial('outerHazeMaterial', scene);
  outerHazeMaterial.diffuseColor = new Color3(0.2, 0.4, 0.8);
  outerHazeMaterial.emissiveColor = new Color3(0.05, 0.1, 0.2);
  outerHazeMaterial.alpha = 0.08;
  outerHazeMaterial.backFaceCulling = true;
  outerHazeMaterial.disableLighting = true;
  outerHaze.material = outerHazeMaterial;

  // Add glow effect to enhance the atmosphere
  const glowLayer = new GlowLayer('atmosphereGlow', scene);
  glowLayer.intensity = 0.5;
  glowLayer.addIncludedOnlyMesh(atmosphere);
  glowLayer.addIncludedOnlyMesh(outerHaze);
}

function createStarfield(scene, ground) {
  // Background sphere for subtle space color
  const starSphere = MeshBuilder.CreateSphere('starfield', { diameter: 2000, segments: 16 }, scene);
  const starMaterial = new StandardMaterial('starMaterial', scene);
  starMaterial.diffuseColor = new Color3(0, 0, 0);
  starMaterial.emissiveColor = new Color3(0.05, 0.05, 0.1);
  starMaterial.backFaceCulling = false;
  starMaterial.disableLighting = true;
  starSphere.material = starMaterial;
  starSphere.infiniteDistance = true;
  starSphere.parent = ground;

  // Use thin instances for stars - much more efficient than 2000 individual meshes
  // Group stars by color type for instancing (3 draw calls instead of 2000)
  const starGroups = [
    { color: new Color3(1, 1, 0.98), weight: 0.90 },      // White stars (90%)
    { color: new Color3(0.9, 0.95, 1), weight: 0.05 },    // Blue-white stars (5%)
    { color: new Color3(1, 0.9, 0.7), weight: 0.05 },     // Yellow-orange stars (5%)
  ];

  const totalStars = 2000;
  const starRadius = 950;

  // Pre-generate all star positions
  const starData = [];
  for (let i = 0; i < totalStars; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const x = starRadius * Math.sin(phi) * Math.cos(theta);
    const y = starRadius * Math.sin(phi) * Math.sin(theta);
    const z = starRadius * Math.cos(phi);
    const size = Math.random() * 2.5 + 0.8;
    const brightness = Math.random() * 0.3 + 0.7;
    const colorRoll = Math.random();

    let colorIndex = 0;
    if (colorRoll > 0.95) colorIndex = 1;      // Blue-white
    else if (colorRoll > 0.90) colorIndex = 2; // Yellow-orange

    starData.push({ x, y, z, size, brightness, colorIndex });
  }

  // Create instanced mesh for each color group
  starGroups.forEach((group, groupIndex) => {
    const starsInGroup = starData.filter(s => s.colorIndex === groupIndex);
    if (starsInGroup.length === 0) return;

    // Create base mesh for this color group
    const baseStar = MeshBuilder.CreateSphere(`starBase${groupIndex}`, { diameter: 1, segments: 4 }, scene);
    const mat = new StandardMaterial(`starGroupMat${groupIndex}`, scene);
    mat.emissiveColor = group.color;
    mat.disableLighting = true;
    baseStar.material = mat;
    baseStar.parent = ground;

    // Register instance buffer for per-instance colors (brightness variation)
    baseStar.thinInstanceRegisterAttribute("color", 4);

    // Add thin instances
    const matricesData = new Float32Array(starsInGroup.length * 16);
    const colorData = new Float32Array(starsInGroup.length * 4);

    starsInGroup.forEach((star, i) => {
      // Create transformation matrix for position and scale
      const matrix = Matrix.Compose(
        new Vector3(star.size, star.size, star.size),  // scale
        new Vector3(0, 0, 0).toQuaternion(),           // rotation (none)
        new Vector3(star.x, star.y, star.z)            // position
      );
      matrix.copyToArray(matricesData, i * 16);

      // Per-instance color with brightness variation
      const b = star.brightness;
      colorData[i * 4] = group.color.r * b;
      colorData[i * 4 + 1] = group.color.g * b;
      colorData[i * 4 + 2] = group.color.b * b;
      colorData[i * 4 + 3] = 1.0;
    });

    baseStar.thinInstanceSetBuffer("matrix", matricesData, 16);
    baseStar.thinInstanceSetBuffer("color", colorData, 4);
  });
}

async function loadR2Model(scene) {
  try {
    const result = await SceneLoader.ImportMeshAsync('', import.meta.env.BASE_URL, 'R2.obj', scene);
    if (result.meshes.length === 0) return;

    const root = result.meshes[0];
    const baseY = 6;
    root.position = new Vector3(0, baseY, 0);
    root.scaling = new Vector3(0.0001, 0.0001, 0.0001);
    root.rotation.x = -Math.PI / 2 + 30 * Math.PI / 180;
    root.rotation.y = Math.PI / 2;

    let time = 0;
    scene.onBeforeRenderObservable.add(() => {
      time += 0.015;
      root.position.y = baseY + Math.sin(time) * 0.12;
      root.rotation.z += Math.cos(time * 0.5) * 0.0001;
    });

    result.meshes.forEach(mesh => {
      if (mesh.material) mesh.createNormals(true);
    });
  } catch (error) {
    console.error('Failed to load R2 model:', error);
  }
}

