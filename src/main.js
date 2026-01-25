import { createScene } from './scene.js';
import { Game } from './game.js';
import { InputHandler } from './input.js';

async function init() {
  // Get or create canvas element
  let canvas = document.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    document.body.appendChild(canvas);
  }

  // Initialize the scene (now async to wait for model loading)
  const { scene, camera, engine, ground, earthTexture } = await createScene(canvas);

  // Create game instance
  const game = new Game(scene, camera, engine, ground, earthTexture);

  // Set up input handler
  new InputHandler(camera, game, scene);

  // Menu elements
  const startMenu = document.getElementById('startMenu');
  const infoPanel = document.getElementById('infoPanel');
  const hud = document.getElementById('hud');
  const gameOverElement = document.getElementById('gameOver');
  const startButton = document.getElementById('startGame');
  const infoButton = document.getElementById('showInfo');
  const gameOverInfoButton = document.getElementById('gameOverInfo');
  const closeInfoButton = document.getElementById('closeInfo');

  // Start game paused with target zone hidden
  game.setPaused(true);
  game.setTargetVisible(false);

  startButton.addEventListener('click', () => {
    startMenu.classList.add('hidden');
    hud.classList.remove('hidden');
    game.setTargetVisible(true);
    game.startGame();
  });

  infoButton.addEventListener('click', () => {
    startMenu.classList.add('hidden');
    infoPanel.classList.remove('hidden');
    infoPanel.dataset.returnTo = 'startMenu';
  });

  gameOverInfoButton.addEventListener('click', () => {
    gameOverElement.classList.add('hidden');
    infoPanel.classList.remove('hidden');
    infoPanel.dataset.returnTo = 'gameOver';
  });

  closeInfoButton.addEventListener('click', () => {
    infoPanel.classList.add('hidden');
    const returnTo = infoPanel.dataset.returnTo || 'startMenu';
    document.getElementById(returnTo).classList.remove('hidden');
  });

  // Game loop
  engine.runRenderLoop(() => {
    game.update();
    scene.render();
  });
}

init();
