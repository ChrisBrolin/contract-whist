/**
 * Client-side State Management
 */

const GameState = {
  // Current state
  roomCode: null,
  gameId: null,
  playerId: null,
  playerName: null,

  // Game data (from server)
  game: null,
  players: [],
  myHand: [],
  myId: null,
  myPosition: null,

  // UI state
  selectedCard: null,
  isCreator: false,
  canStart: false,

  // Listeners
  listeners: new Map(),

  /**
   * Initialize state from localStorage
   */
  init() {
    this.playerName = localStorage.getItem('playerName') || '';
  },

  /**
   * Update state and notify listeners
   */
  update(newState) {
    Object.assign(this, newState);
    this.notify('stateChange', this);
  },

  /**
   * Set room info after joining/creating
   */
  setRoom(roomCode, gameId, playerId) {
    this.roomCode = roomCode;
    this.gameId = gameId;
    this.playerId = playerId;
    localStorage.setItem('currentRoom', roomCode);
    this.notify('roomJoined', { roomCode, gameId, playerId });
  },

  /**
   * Update from server game state
   */
  updateFromServer(serverState) {
    this.game = serverState.game;
    this.players = serverState.players;
    this.myHand = serverState.myHand || [];
    this.myId = serverState.myId;
    this.myPosition = serverState.myPosition;
    this.isCreator = serverState.isCreator;
    this.canStart = serverState.canStart;

    this.notify('gameStateUpdated', serverState);
  },

  /**
   * Set player name
   */
  setPlayerName(name) {
    this.playerName = name;
    localStorage.setItem('playerName', name);
  },

  /**
   * Select a card
   */
  selectCard(card) {
    if (this.selectedCard &&
        this.selectedCard.suit === card.suit &&
        this.selectedCard.rank === card.rank) {
      this.selectedCard = null;
    } else {
      this.selectedCard = card;
    }
    this.notify('cardSelected', this.selectedCard);
  },

  /**
   * Clear selection
   */
  clearSelection() {
    this.selectedCard = null;
    this.notify('cardSelected', null);
  },

  /**
   * Reset state (on leave/disconnect)
   */
  reset() {
    this.roomCode = null;
    this.gameId = null;
    this.playerId = null;
    this.game = null;
    this.players = [];
    this.myHand = [];
    this.myId = null;
    this.myPosition = null;
    this.selectedCard = null;
    this.isCreator = false;
    this.canStart = false;
    localStorage.removeItem('currentRoom');
    this.notify('stateReset');
  },

  /**
   * Get current phase
   */
  getPhase() {
    return this.game?.current_phase || 'waiting';
  },

  /**
   * Check if it's my turn
   */
  isMyTurn() {
    if (!this.game || !this.players.length) return false;

    const currentPlayer = this.players[this.game.current_player_index];
    return currentPlayer?.id === this.myId;
  },

  /**
   * Get my player info
   */
  getMyPlayer() {
    return this.players.find(p => p.id === this.myId);
  },

  /**
   * Get other players (for UI positioning)
   */
  getOtherPlayers() {
    return this.players.filter(p => p.id !== this.myId);
  },

  /**
   * Get valid cards I can play
   */
  getValidCards() {
    if (!this.game || !this.myHand.length) return [];

    const currentTrick = this.game.current_trick || [];
    if (currentTrick.length === 0) {
      // Leading - can play anything
      return [...this.myHand];
    }

    const leadSuit = currentTrick[0].card.suit;
    const suitCards = this.myHand.filter(c => c.suit === leadSuit);

    if (suitCards.length > 0) {
      return suitCards;
    }

    // Can't follow suit - play anything
    return [...this.myHand];
  },

  /**
   * Check if a card is valid to play
   */
  isCardValid(card) {
    const validCards = this.getValidCards();
    return validCards.some(c => c.suit === card.suit && c.rank === card.rank);
  },

  /**
   * Get bids so far this round
   */
  getBidsSoFar() {
    return this.players
      .filter(p => p.current_bid !== null)
      .map(p => p.current_bid);
  },

  /**
   * Check if I'm the last bidder
   */
  isLastBidder() {
    const bidsMade = this.players.filter(p => p.current_bid !== null).length;
    return bidsMade === this.players.length - 1;
  },

  /**
   * Get invalid bids (for last bidder restriction)
   * Rule: Total bids cannot equal the number of tricks in the round
   */
  getInvalidBids() {
    if (!this.isLastBidder()) return [];

    const bidsSoFar = this.getBidsSoFar();
    const sumSoFar = bidsSoFar.reduce((a, b) => a + b, 0);
    const currentRound = this.game?.current_round || 7;

    const invalid = [];
    for (let bid = 0; bid <= currentRound; bid++) {
      if (sumSoFar + bid === currentRound) {
        invalid.push(bid);
      }
    }
    return invalid;
  },

  /**
   * Subscribe to state changes
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  },

  /**
   * Unsubscribe
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  },

  /**
   * Notify listeners
   */
  notify(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error('State listener error:', e);
      }
    });
  }
};

// Initialize
GameState.init();

window.GameState = GameState;
