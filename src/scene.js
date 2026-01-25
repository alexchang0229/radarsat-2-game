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
  GlowLayer,
} from '@babylonjs/core';
import '@babylonjs/loaders/OBJ';
import earthTextureUrl from './Earth.jpg';


export async function createScene(canvas) {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.clearColor = new Color3(0.02, 0.02, 0.05);

  const camera = new FreeCamera('camera', new Vector3(10, 10, 10), scene);
  camera.setTarget(new Vector3(0, 0, -5));
  camera.fov = 0.9;

  const ambientLight = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
  ambientLight.intensity = 0.02;
  ambientLight.groundColor = new Color3(0, 0, 0);

  const directionalLight = new DirectionalLight('directional', new Vector3(-1, -0.1, 0), scene);
  directionalLight.intensity = 1.5;

  createStarfield(scene);
  const { ground, earthTexture } = createTrack(scene);
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
  const atmosphereRadius = sphereRadius * 1.01;
  const atmosphere = MeshBuilder.CreateSphere('atmosphere', {
    diameter: atmosphereRadius * 2,
    segments: 64
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
    segments: 32
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

function createStarfield(scene) {
  const starSphere = MeshBuilder.CreateSphere('starfield', { diameter: 2000, segments: 32 }, scene);
  const starMaterial = new StandardMaterial('starMaterial', scene);
  starMaterial.diffuseColor = new Color3(0, 0, 0);
  starMaterial.emissiveColor = new Color3(0.05, 0.05, 0.1);
  starMaterial.backFaceCulling = false;
  starMaterial.disableLighting = true;
  starSphere.material = starMaterial;
  starSphere.infiniteDistance = true;

  for (let i = 0; i < 2000; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const x = 950 * Math.sin(phi) * Math.cos(theta);
    const y = 950 * Math.sin(phi) * Math.sin(theta);
    const z = 950 * Math.cos(phi);

    const star = MeshBuilder.CreateSphere(`star${i}`, { diameter: Math.random() * 2.5 + 0.8, segments: 6 }, scene);
    star.position.set(x, y, z);

    const mat = new StandardMaterial(`starMat${i}`, scene);
    const brightness = Math.random() * 0.3 + 0.7;
    const colorVar = Math.random();
    if (colorVar > 0.95) {
      mat.emissiveColor = new Color3(brightness * 0.9, brightness * 0.95, brightness);
    } else if (colorVar > 0.90) {
      mat.emissiveColor = new Color3(brightness, brightness * 0.9, brightness * 0.7);
    } else {
      mat.emissiveColor = new Color3(brightness, brightness, brightness * 0.98);
    }
    mat.disableLighting = true;
    star.material = mat;
  }
}

async function loadR2Model(scene) {
  try {
    const result = await SceneLoader.ImportMeshAsync('', '/', 'R2.obj', scene);
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

