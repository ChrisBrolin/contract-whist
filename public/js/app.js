/**
 * Main Application Entry Point
 */

const App = {
  /**
   * Initialize the application
   */
  async init() {
    console.log('Contract Whist initializing...');

    // Initialize UI
    UI.init();

    // Initialize Supabase (if configured)
    // These should be set in environment or via a config endpoint
    if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
      SupabaseClient.init(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    }

    // Set up event listeners
    this.setupEventListeners();

    // Check for active game
    await this.checkActiveGame();

    console.log('Contract Whist ready!');
  },

  /**
   * Set up all event listeners
   */
  setupEventListeners() {
    // Home screen
    document.getElementById('btn-create').addEventListener('click', () => this.createGame());
    document.getElementById('btn-join-screen').addEventListener('click', () => UI.showScreen('join'));
    document.getElementById('btn-rejoin').addEventListener('click', () => this.rejoinGame());

    // Player name input
    document.getElementById('player-name').addEventListener('input', (e) => {
      GameState.setPlayerName(e.target.value);
    });

    // Join screen
    document.getElementById('btn-back-home').addEventListener('click', () => UI.showScreen('home'));
    document.getElementById('btn-join').addEventListener('click', () => this.joinGame());
    document.getElementById('room-code').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.joinGame();
    });

    // Lobby screen
    document.getElementById('btn-start').addEventListener('click', () => this.startGame());
    document.getElementById('btn-leave').addEventListener('click', () => this.leaveGame());
    document.getElementById('btn-copy-code').addEventListener('click', () => this.copyRoomCode());

    // Round summary
    document.getElementById('btn-next-round').addEventListener('click', () => {
      UI.showScreen('game');
      UI.updateGame();
    });

    // Game end
    document.getElementById('btn-play-again').addEventListener('click', () => this.playAgain());
    document.getElementById('btn-new-game').addEventListener('click', () => this.newGame());

    // State change listeners
    GameState.on('gameStateUpdated', (state) => this.onGameStateUpdated(state));
  },

  /**
   * Check for active game on load
   */
  async checkActiveGame() {
    try {
      const result = await API.checkActiveGame();

      if (result.hasActiveGame) {
        UI.updateRejoinSection(true, result.roomCode);

        // Store info for rejoin
        GameState.roomCode = result.roomCode;
        GameState.gameId = result.gameId;
        GameState.playerId = result.playerId;
        GameState.playerName = result.playerName;

        // Update name input
        document.getElementById('player-name').value = result.playerName;
      }
    } catch (error) {
      console.log('No active game found');
    }
  },

  /**
   * Create a new game
   */
  async createGame() {
    const playerName = GameState.playerName?.trim();

    if (!playerName) {
      UI.showToast('Please enter your name', 'error');
      return;
    }

    try {
      UI.showLoading(true);

      const result = await API.createGame(playerName);

      GameState.setRoom(result.roomCode, result.gameId, result.playerId);

      // Subscribe to updates
      await Realtime.subscribe(result.roomCode);

      // Get initial state
      const state = await API.getGameState(result.roomCode);
      GameState.updateFromServer(state);

      UI.showScreen('lobby');
      UI.updateLobby();

    } catch (error) {
      UI.showToast(error.message, 'error');
    } finally {
      UI.showLoading(false);
    }
  },

  /**
   * Join an existing game
   */
  async joinGame() {
    const playerName = GameState.playerName?.trim();
    const roomCode = document.getElementById('room-code').value.trim().toUpperCase();

    if (!playerName) {
      UI.showToast('Please enter your name on the home screen', 'error');
      return;
    }

    if (!roomCode || roomCode.length !== 6) {
      UI.showToast('Please enter a valid 6-character room code', 'error');
      return;
    }

    try {
      UI.showLoading(true);

      const result = await API.joinGame(roomCode, playerName);

      GameState.setRoom(result.roomCode, result.gameId, result.playerId);

      // Subscribe to updates
      await Realtime.subscribe(result.roomCode);

      // Get initial state
      const state = await API.getGameState(result.roomCode);
      GameState.updateFromServer(state);

      if (state.game.status === 'lobby') {
        UI.showScreen('lobby');
        UI.updateLobby();
      } else {
        UI.showScreen('game');
        UI.updateGame();
      }

      if (result.rejoined) {
        UI.showToast('Rejoined game!', 'success');
      }

    } catch (error) {
      UI.showToast(error.message, 'error');
    } finally {
      UI.showLoading(false);
    }
  },

  /**
   * Rejoin an active game
   */
  async rejoinGame() {
    const roomCode = GameState.roomCode;

    if (!roomCode) {
      UI.showToast('No active game to rejoin', 'error');
      return;
    }

    try {
      UI.showLoading(true);

      // Subscribe to updates
      await Realtime.subscribe(roomCode);

      // Get current state
      const state = await API.getGameState(roomCode);
      GameState.updateFromServer(state);

      if (state.game.status === 'lobby') {
        UI.showScreen('lobby');
        UI.updateLobby();
      } else if (state.game.status === 'playing') {
        UI.showScreen('game');
        UI.updateGame();
      } else {
        UI.showScreen('home');
        UI.showToast('Game has ended', 'info');
      }

    } catch (error) {
      UI.showToast(error.message, 'error');
      GameState.reset();
    } finally {
      UI.showLoading(false);
    }
  },

  /**
   * Start the game
   */
  async startGame() {
    try {
      UI.showLoading(true);
      await API.startGame(GameState.roomCode);
      // State will update via realtime
    } catch (error) {
      UI.showToast(error.message, 'error');
    } finally {
      UI.showLoading(false);
    }
  },

  /**
   * Leave the game
   */
  async leaveGame() {
    try {
      UI.showLoading(true);
      await API.leaveGame(GameState.roomCode);

      await Realtime.unsubscribe();
      GameState.reset();
      UI.updateRejoinSection(false);

      UI.showScreen('home');

    } catch (error) {
      UI.showToast(error.message, 'error');
    } finally {
      UI.showLoading(false);
    }
  },

  /**
   * Copy room code to clipboard
   */
  async copyRoomCode() {
    try {
      await navigator.clipboard.writeText(GameState.roomCode);
      UI.showToast('Room code copied!', 'success');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = GameState.roomCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      UI.showToast('Room code copied!', 'success');
    }
  },

  /**
   * Handle game state updates
   */
  onGameStateUpdated(state) {
    const phase = state.game?.current_phase;
    const status = state.game?.status;

    console.log('Game state updated:', status, phase);

    if (status === 'lobby') {
      if (UI.currentScreen !== 'lobby') {
        UI.showScreen('lobby');
      }
      UI.updateLobby();
    } else if (status === 'playing') {
      if (phase === 'bidding' || phase === 'playing') {
        if (UI.currentScreen !== 'game') {
          UI.showScreen('game');
        }
        UI.updateGame();
      } else if (phase === 'game_end') {
        UI.showGameEnd();
      }
    } else if (status === 'finished') {
      UI.showGameEnd();
    }
  },

  /**
   * Play again with same players
   */
  async playAgain() {
    // This would need server-side support to reset the game
    // For now, just go back to lobby concept
    UI.showToast('Feature coming soon!', 'info');
  },

  /**
   * Start a new game
   */
  async newGame() {
    await Realtime.unsubscribe();
    GameState.reset();
    UI.updateRejoinSection(false);
    UI.showScreen('home');
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

window.App = App;
