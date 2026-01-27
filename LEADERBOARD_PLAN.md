# Leaderboard Implementation Plan

## Architecture

**Two-tier approach: localStorage (local persistence) + optional Firebase Realtime Database (global leaderboard)**

- **localStorage** provides instant local persistence with zero dependencies. Works offline, needs no account setup. Handles the "personal high scores" use case.
- **Firebase Realtime Database** works directly from static hosting (no server). Free Spark plan: 1GB storage, 10GB/month downloads, 100 concurrent connections. Security rules enforce write-once semantics and score validation without a backend.

The plan is structured so localStorage stands alone and Firebase is a clean optional addition.

## Data Structures

```javascript
// Score entry (used by both local and online)
{ name: string, score: number, date: string /* ISO 8601 */ }

// localStorage keys:
//   "radarsat2_scores"     -> JSON array of up to 20 entries, sorted desc by score
//   "radarsat2_playerName" -> last used player name string

// Firebase path: /scores/{pushId}
//   Adds a schema version field: { name, score, date, v: 1 }
```

## Game Flow

```
START MENU                        GAME OVER
┌─────────────────────┐          ┌──────────────────────────┐
│ RADARSAT-2: The Game │          │ Final Score: 3200        │
│                      │          │ High Score: 4500         │
│   [ Start Game ]     │          │                          │
│   [ Leaderboard ] <──┼── NEW   │   [ Restart ]            │
│   [ About ]          │          │   [ Leaderboard ] <── NEW│
└─────────────────────┘          │   [ About ]              │
                                  └──────────┬───────────────┘
                                             │ (auto-shows after game over)
                                             v
                                  ┌──────────────────────────┐
                                  │ New High Score!          │
                                  │ Score: 3200              │
                                  │                          │
                                  │ [  Your name  ]          │
                                  │                          │
                                  │ [ Submit ]  [ Skip ]     │
                                  └──────────┬───────────────┘
                                             │ (submit or skip)
                                             v
                                  ┌──────────────────────────┐
                                  │ LEADERBOARD              │
                                  │ [Local]  [Global]        │
                                  │ ──────────────────       │
                                  │ 1. Alex ......... 4500   │
                                  │ 2. Player ....... 3200 < │
                                  │ 3. Guest ........ 2800   │
                                  │                          │
                                  │ [ Back ]                 │
                                  └──────────────────────────┘
```

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/leaderboard.js` | **CREATE** | `LocalLeaderboard` class (localStorage CRUD), `OnlineLeaderboard` class (Firebase), `createLeaderboard()` factory (~120 lines) |
| `src/firebaseConfig.js` | **CREATE** | Firebase config object (~12 lines, Phase 2) |
| `src/game.js` | **MODIFY** | Accept `leaderboard` param in constructor, load persisted highScore, add `onGameOver` callback (~10 lines changed) |
| `src/main.js` | **MODIFY** | Import leaderboard, wire up name input flow, leaderboard display, tab switching, button handlers (~80 lines added) |
| `index.html` | **MODIFY** | Add `#nameInput` panel, `#leaderboard` panel, two new buttons (~25 lines) |
| `style.css` | **MODIFY** | Styles for new panels/buttons matching existing design (~100 lines) |
| `package.json` | **MODIFY** | Add `firebase` dependency (Phase 2 only) |

## Implementation Order

### Phase 1: localStorage leaderboard (no external dependencies)

1. **Create `src/leaderboard.js`** with `LocalLeaderboard` class only
2. **Modify `src/game.js`** — add leaderboard param, persisted highScore, `onGameOver` hook
3. **Modify `index.html`** — add name input panel, leaderboard panel, new buttons
4. **Modify `style.css`** — styles for all new UI elements
5. **Modify `src/main.js`** — orchestrate game-over → name input → leaderboard flow
6. **Test locally**

### Phase 2: Firebase online leaderboard (optional)

7. Create Firebase project, enable Realtime Database, set security rules
8. Add `firebase` to `package.json`, run `npm install`
9. Create `src/firebaseConfig.js` with config object
10. Add `OnlineLeaderboard` class to `src/leaderboard.js` (dynamic import for code-splitting)
11. Update `src/main.js` to pass Firebase config and handle Global tab
12. Test end-to-end

## Detailed Implementation

### src/leaderboard.js

```javascript
const LOCAL_SCORES_KEY = 'radarsat2_scores';
const LOCAL_NAME_KEY = 'radarsat2_playerName';
const MAX_LOCAL_SCORES = 20;
const MAX_VALID_SCORE = 50000;
const NAME_REGEX = /^[a-zA-Z0-9 ]{1,12}$/;

class LocalLeaderboard {
  getScores() {
    try {
      const raw = localStorage.getItem(LOCAL_SCORES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  addScore(name, score) {
    const scores = this.getScores();
    const entry = { name, score, date: new Date().toISOString() };
    scores.push(entry);
    scores.sort((a, b) => b.score - a.score);
    const trimmed = scores.slice(0, MAX_LOCAL_SCORES);
    localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(trimmed));
    this.setLastPlayerName(name);
    return { rank: trimmed.findIndex(s => s === entry) + 1 };
  }

  isHighScore(score) {
    const scores = this.getScores();
    if (scores.length < MAX_LOCAL_SCORES) return true;
    return score > scores[scores.length - 1].score;
  }

  getHighScore() {
    const scores = this.getScores();
    return scores.length > 0 ? scores[0].score : 0;
  }

  getLastPlayerName() {
    return localStorage.getItem(LOCAL_NAME_KEY);
  }

  setLastPlayerName(name) {
    localStorage.setItem(LOCAL_NAME_KEY, name);
  }
}

class OnlineLeaderboard {
  constructor(firebaseConfig) {
    this.config = firebaseConfig;
    this.db = null;
    this._available = false;
  }

  async init() {
    try {
      const { initializeApp } = await import('firebase/app');
      const { getDatabase, ref, push, query, orderByChild, limitToLast, get }
        = await import('firebase/database');
      const app = initializeApp(this.config);
      this.db = getDatabase(app);
      this._ref = ref;
      this._push = push;
      this._query = query;
      this._orderByChild = orderByChild;
      this._limitToLast = limitToLast;
      this._get = get;
      this._available = true;
    } catch (err) {
      console.warn('Online leaderboard unavailable:', err);
      this._available = false;
    }
  }

  isAvailable() { return this._available; }

  async submitScore(name, score) {
    if (!this._available) return;
    if (score < 0 || score > MAX_VALID_SCORE) return;
    if (!NAME_REGEX.test(name)) return;
    const scoresRef = this._ref(this.db, 'scores');
    await this._push(scoresRef, {
      name: name.trim(), score, date: new Date().toISOString(), v: 1,
    });
  }

  async getTopScores(limit = 10) {
    if (!this._available) return [];
    const scoresRef = this._ref(this.db, 'scores');
    const q = this._query(scoresRef, this._orderByChild('score'), this._limitToLast(limit));
    const snapshot = await this._get(q);
    const results = [];
    snapshot.forEach(child => results.push(child.val()));
    return results.reverse();
  }
}

export function createLeaderboard(firebaseConfig) {
  const local = new LocalLeaderboard();
  let online = null;
  if (firebaseConfig) {
    online = new OnlineLeaderboard(firebaseConfig);
    online.init();
  }
  return { local, online };
}
```

### game.js Changes

```javascript
// Constructor: accept leaderboard param
constructor(scene, camera, engine, ground, earthTexture, leaderboard) {
  // ...existing code...
  this.leaderboard = leaderboard;
  this.highScore = leaderboard ? leaderboard.local.getHighScore() : 0;
}

// triggerGameOver: add callback hook
triggerGameOver() {
  this.gameOver = true;
  this.finalScoreElement.textContent = this.score;
  this.finalHighScoreElement.textContent = this.highScore;
  if (this.onGameOver) {
    this.onGameOver(this.score);
  } else {
    this.gameOverElement.classList.remove("hidden");
  }
  this.setTargetVisible(false);
}
```

### index.html Additions

```html
<!-- After #gameOver div -->
<div id="nameInput" class="hidden">
  <h2>New High Score!</h2>
  <p>Score: <span id="nameInputScore">0</span></p>
  <input type="text" id="playerName" placeholder="Your name" maxlength="12"
         autocomplete="off" spellcheck="false">
  <button id="submitScore">Submit</button>
  <button id="skipScore">Skip</button>
</div>

<div id="leaderboard" class="hidden">
  <h2>Leaderboard</h2>
  <div id="leaderboardTabs">
    <button id="tabLocal" class="tab active">Local</button>
    <button id="tabOnline" class="tab">Global</button>
  </div>
  <div id="leaderboardList"></div>
  <button id="closeLeaderboard">Back</button>
</div>

<!-- Add to start menu -->
<button id="showLeaderboard">Leaderboard</button>

<!-- Add to game over screen -->
<button id="gameOverLeaderboard">Leaderboard</button>
```

### main.js Orchestration

```javascript
import { createLeaderboard } from './leaderboard.js';

// Initialize
const leaderboard = createLeaderboard(/* firebaseConfig */);
const game = new Game(scene, camera, engine, ground, earthTexture, leaderboard);

// Game over -> name input flow
game.onGameOver = (finalScore) => {
  nameInputScore.textContent = finalScore;
  playerNameInput.value = leaderboard.local.getLastPlayerName() || '';
  nameInputPanel.classList.remove('hidden');
  setTimeout(() => playerNameInput.focus(), 100);
};

// Submit score handler
submitScoreBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim() || 'Anonymous';
  leaderboard.local.addScore(name, game.score);
  if (leaderboard.online?.isAvailable()) {
    leaderboard.online.submitScore(name, game.score);
  }
  game.highScore = leaderboard.local.getHighScore();
  nameInputPanel.classList.add('hidden');
  showLeaderboard('local', 'gameOver');
});

// Leaderboard rendering
async function renderLeaderboard() {
  let scores = currentTab === 'online' && leaderboard.online
    ? await leaderboard.online.getTopScores(10)
    : leaderboard.local.getScores().slice(0, 10);
  // Render entries with rank, name, score; highlight current player
}
```

## Firebase Security Rules

```json
{
  "rules": {
    "scores": {
      ".read": true,
      "$scoreId": {
        ".write": "!data.exists()",
        ".validate": "newData.hasChildren(['name','score','date','v']) && newData.child('name').isString() && newData.child('name').val().length >= 1 && newData.child('name').val().length <= 12 && newData.child('score').isNumber() && newData.child('score').val() >= 0 && newData.child('score').val() <= 50000 && newData.child('date').isString() && newData.child('v').isNumber()"
      }
    }
  }
}
```

## Security & Anti-Cheat

- **Firebase rules**: Write-once (no edits/deletes), type validation, score capped at 50,000
- **Client validation**: `MAX_VALID_SCORE` check before submit, name regex validation
- **XSS prevention**: `escapeHtml()` helper sanitizes names before rendering
- **Graceful degradation**: localStorage wrapped in try/catch, Firebase loaded dynamically with fallback

## Potential Challenges

| Challenge | Mitigation |
|-----------|------------|
| Firebase SDK adds ~50KB gzipped | Dynamic `import()` for code-splitting |
| localStorage disabled (private browsing) | try/catch fallback to session-only |
| Mobile keyboard overlaps name input | Centered panel, browser auto-scrolls |
| XSS via player names | `escapeHtml()` sanitization |
| Impossible scores from devtools | Firebase rules cap at 50,000; write-once prevents edits |
