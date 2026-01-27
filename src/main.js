import { createScene } from './scene.js';
import { Game } from './game.js';
import { InputHandler } from './input.js';
import { createLeaderboard, getLastPlayerName, setLastPlayerName } from './leaderboard.js';
import { firebaseConfig } from './firebaseConfig.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

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

  // Initialize leaderboard (global only via Firebase)
  const leaderboard = createLeaderboard(firebaseConfig);

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

  // Leaderboard elements
  const nameInputPanel = document.getElementById('nameInput');
  const nameInputScore = document.getElementById('nameInputScore');
  const playerNameInput = document.getElementById('playerName');
  const submitScoreBtn = document.getElementById('submitScore');
  const skipScoreBtn = document.getElementById('skipScore');
  const leaderboardPanel = document.getElementById('leaderboard');
  const leaderboardList = document.getElementById('leaderboardList');
  const closeLeaderboardBtn = document.getElementById('closeLeaderboard');
  const showLeaderboardBtn = document.getElementById('showLeaderboard');
  const gameOverLeaderboardBtn = document.getElementById('gameOverLeaderboard');

  let returnFromLeaderboard = 'startMenu';
  let lastSubmittedScore = null;

  // Start game paused with target zone hidden
  game.setPaused(true);
  game.setTargetVisible(false);

  // Game over callback — show name input instead of game over screen directly
  game.onGameOver = (finalScore) => {
    lastSubmittedScore = null;
    nameInputScore.textContent = finalScore;
    playerNameInput.value = getLastPlayerName() || '';
    nameInputPanel.classList.remove('hidden');
    setTimeout(() => playerNameInput.focus(), 100);
  };

  // Submit score
  submitScoreBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim() || 'Anonymous';
    setLastPlayerName(name);
    if (leaderboard.isAvailable()) {
      leaderboard.submitScore(name, game.score);
    }
    lastSubmittedScore = { name, score: game.score };
    nameInputPanel.classList.add('hidden');
    showLeaderboard('gameOver');
  });

  // Skip — go straight to game over screen
  skipScoreBtn.addEventListener('click', () => {
    nameInputPanel.classList.add('hidden');
    gameOverElement.classList.remove('hidden');
  });

  // Enter key in name input triggers submit
  playerNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitScoreBtn.click();
  });

  // Leaderboard display
  function showLeaderboard(returnTo) {
    returnFromLeaderboard = returnTo || 'startMenu';
    renderLeaderboard();

    startMenu.classList.add('hidden');
    gameOverElement.classList.add('hidden');
    leaderboardPanel.classList.remove('hidden');
  }

  async function renderLeaderboard() {
    leaderboardList.innerHTML = '<div class="leaderboard-empty">Loading...</div>';

    const scores = await leaderboard.getTopScores(10);

    if (scores.length === 0) {
      leaderboardList.innerHTML =
        '<div class="leaderboard-empty">No scores yet. Play a game!</div>';
      return;
    }

    leaderboardList.innerHTML = scores
      .map((entry, i) => {
        const isCurrentScore =
          lastSubmittedScore &&
          entry.score === lastSubmittedScore.score &&
          entry.name === lastSubmittedScore.name;
        return `
        <div class="leaderboard-entry ${isCurrentScore ? 'highlight' : ''}">
          <span class="leaderboard-rank">${i + 1}.</span>
          <span class="leaderboard-name">${escapeHtml(entry.name)}</span>
          <span class="leaderboard-score">${entry.score.toLocaleString()}</span>
        </div>`;
      })
      .join('');
  }

  // Close leaderboard
  closeLeaderboardBtn.addEventListener('click', () => {
    leaderboardPanel.classList.add('hidden');
    if (returnFromLeaderboard === 'gameOver') {
      gameOverElement.classList.remove('hidden');
    } else {
      startMenu.classList.remove('hidden');
    }
  });

  // Open leaderboard from start menu
  showLeaderboardBtn.addEventListener('click', () => {
    showLeaderboard('startMenu');
  });

  // Open leaderboard from game over
  gameOverLeaderboardBtn.addEventListener('click', () => {
    showLeaderboard('gameOver');
  });

  // Start game
  startButton.addEventListener('click', () => {
    startMenu.classList.add('hidden');
    hud.classList.remove('hidden');
    game.setTargetVisible(true);
    game.startGame();
  });

  // Info panel
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
