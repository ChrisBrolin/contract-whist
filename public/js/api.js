/**
 * API Client for Contract Whist
 */

const API = {
  /**
   * Get session ID from localStorage or create new one
   */
  getSessionId() {
    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  },

  /**
   * Make API request with session ID header
   */
  async request(action, data = {}) {
    const sessionId = this.getSessionId();

    const response = await fetch('/api/games', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId
      },
      body: JSON.stringify({ action, ...data })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Request failed');
    }

    return result;
  },

  /**
   * Create a new game
   */
  async createGame(playerName) {
    return this.request('create', { playerName });
  },

  /**
   * Join an existing game
   */
  async joinGame(roomCode, playerName) {
    return this.request('join', { roomCode, playerName });
  },

  /**
   * Get game state
   */
  async getGameState(roomCode) {
    return this.request('get', { roomCode });
  },

  /**
   * Start the game with optional starting round count
   */
  async startGame(roomCode, startingRound = 7) {
    return this.request('start', { roomCode, startingRound });
  },

  /**
   * Leave the game
   */
  async leaveGame(roomCode) {
    return this.request('leave', { roomCode });
  },

  /**
   * Advance to next round (after viewing round summary)
   */
  async nextRound(roomCode) {
    return this.request('next-round', { roomCode });
  },

  /**
   * Submit a bid
   */
  async submitBid(roomCode, bid) {
    return this.request('bid', { roomCode, bid });
  },

  /**
   * Play a card
   */
  async playCard(roomCode, card) {
    return this.request('play', { roomCode, card });
  },

  /**
   * Check for active game
   */
  async checkActiveGame() {
    return this.request('active', {});
  }
};

window.API = API;
