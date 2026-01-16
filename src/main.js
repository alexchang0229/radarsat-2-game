import { createScene } from './scene.js';
import { Game } from './game.js';
import { InputHandler } from './input.js';

// Get or create canvas element
let canvas = document.querySelector('canvas');
if (!canvas) {
  canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  document.body.appendChild(canvas);
}

// Initialize the scene
const { scene, camera, engine, ground } = createScene(canvas);

// Create game instance
const game = new Game(scene, camera, engine, ground);

// Set up input handler
const inputHandler = new InputHandler(camera, game, scene);

// Game loop
engine.runRenderLoop(() => {
  game.update();
  scene.render();
});
