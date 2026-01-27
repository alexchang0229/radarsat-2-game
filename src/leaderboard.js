const LOCAL_NAME_KEY = 'radarsat2_playerName';
const MAX_VALID_SCORE = 50000;
const NAME_REGEX = /^[a-zA-Z0-9 ]{1,12}$/;

class OnlineLeaderboard {
  constructor(firebaseConfig) {
    this.config = firebaseConfig;
    this.db = null;
    this._available = false;
    this._initPromise = null;
  }

  async init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit();
    return this._initPromise;
  }

  async _doInit() {
    try {
      const { initializeApp } = await import('firebase/app');
      const { getDatabase, ref, push, query, orderByChild, limitToLast, onValue } =
        await import('firebase/database');

      const app = initializeApp(this.config);
      this.db = getDatabase(app);
      this._ref = ref;
      this._push = push;
      this._query = query;
      this._orderByChild = orderByChild;
      this._limitToLast = limitToLast;
      this._onValue = onValue;
      this._available = true;
    } catch (err) {
      console.warn('Online leaderboard unavailable:', err);
      this._available = false;
    }
  }

  isAvailable() {
    return this._available;
  }

  async submitScore(name, score) {
    if (!this._available) return;
    if (score < 0 || score > MAX_VALID_SCORE) return;
    if (!NAME_REGEX.test(name)) return;

    try {
      const scoresRef = this._ref(this.db, 'scores');
      await this._push(scoresRef, {
        name: name.trim(),
        score,
        date: new Date().toISOString(),
        v: 1,
      });
    } catch (err) {
      console.warn('Failed to submit score online:', err);
    }
  }

  async getTopScores(limit = 10) {
    if (!this._available) return [];
    try {
      const scoresRef = this._ref(this.db, 'scores');
      const q = this._query(
        scoresRef,
        this._orderByChild('score'),
        this._limitToLast(limit)
      );
      return new Promise((resolve) => {
        const unsubscribe = this._onValue(q, (snapshot) => {
          const results = [];
          snapshot.forEach((child) => results.push(child.val()));
          unsubscribe();
          // limitToLast returns ascending order; reverse for descending
          resolve(results.reverse());
        }, (err) => {
          console.warn('Failed to fetch online scores:', err);
          resolve([]);
        });
      });
    } catch (err) {
      console.warn('Failed to fetch online scores:', err);
      return [];
    }
  }
}

export function getLastPlayerName() {
  try {
    return localStorage.getItem(LOCAL_NAME_KEY);
  } catch {
    return null;
  }
}

export function setLastPlayerName(name) {
  try {
    localStorage.setItem(LOCAL_NAME_KEY, name);
  } catch {
    // localStorage may be disabled
  }
}

export function createLeaderboard(firebaseConfig) {
  const leaderboard = new OnlineLeaderboard(firebaseConfig);
  leaderboard.init();
  return leaderboard;
}
