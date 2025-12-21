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
  async request(endpoint, options = {}) {
    const sessionId = this.getSessionId();

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId,
        ...options.headers
      }
    };

    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch(`/api${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  },

  /**
   * Create a new game
   */
  async createGame(playerName) {
    return this.request('/games/create', {
      method: 'POST',
      body: { playerName, sessionId: this.getSessionId() }
    });
  },

  /**
   * Join an existing game
   */
  async joinGame(roomCode, playerName) {
    return this.request('/games/join', {
      method: 'POST',
      body: { roomCode, playerName, sessionId: this.getSessionId() }
    });
  },

  /**
   * Get game state
   */
  async getGameState(roomCode) {
    return this.request(`/games/${roomCode}`, {
      method: 'GET'
    });
  },

  /**
   * Start the game
   */
  async startGame(roomCode) {
    return this.request('/games/start', {
      method: 'POST',
      body: { roomCode }
    });
  },

  /**
   * Leave the game
   */
  async leaveGame(roomCode) {
    return this.request('/games/leave', {
      method: 'POST',
      body: { roomCode }
    });
  },

  /**
   * Submit a bid
   */
  async submitBid(roomCode, bid) {
    return this.request('/actions/bid', {
      method: 'POST',
      body: { roomCode, bid }
    });
  },

  /**
   * Play a card
   */
  async playCard(roomCode, card) {
    return this.request('/actions/play', {
      method: 'POST',
      body: { roomCode, card }
    });
  },

  /**
   * Check for active game
   */
  async checkActiveGame() {
    return this.request('/session/active-game', {
      method: 'GET'
    });
  }
};

window.API = API;
