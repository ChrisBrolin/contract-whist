/**
 * UI Rendering
 */

const UI = {
  // Screen elements
  screens: {},
  currentScreen: 'home',

  /**
   * Initialize UI
   */
  init() {
    // Cache screen elements
    this.screens = {
      home: document.getElementById('screen-home'),
      join: document.getElementById('screen-join'),
      lobby: document.getElementById('screen-lobby'),
      game: document.getElementById('screen-game'),
      roundSummary: document.getElementById('screen-round-summary'),
      gameEnd: document.getElementById('screen-game-end')
    };

    // Set initial player name from state
    const nameInput = document.getElementById('player-name');
    if (nameInput && GameState.playerName) {
      nameInput.value = GameState.playerName;
    }
  },

  /**
   * Show a specific screen
   */
  showScreen(screenName) {
    Object.values(this.screens).forEach(screen => {
      screen.classList.remove('active');
    });

    const screen = this.screens[screenName];
    if (screen) {
      screen.classList.add('active');
      this.currentScreen = screenName;
    }
  },

  /**
   * Show loading overlay
   */
  showLoading(show = true) {
    const overlay = document.getElementById('loading-overlay');
    if (show) {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  },

  /**
   * Show toast notification
   */
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /**
   * Update lobby screen
   */
  updateLobby() {
    const roomCodeEl = document.getElementById('lobby-room-code');
    const playersList = document.getElementById('lobby-players');
    const startBtn = document.getElementById('btn-start');
    const statusEl = document.getElementById('lobby-status');

    roomCodeEl.textContent = GameState.roomCode || '------';

    // Update players list
    playersList.innerHTML = '';
    GameState.players.forEach((player, index) => {
      const li = document.createElement('li');
      li.textContent = player.name;
      if (index === 0) li.classList.add('creator');
      if (!player.is_connected) li.style.opacity = '0.5';
      playersList.appendChild(li);
    });

    // Show/hide start button
    if (GameState.isCreator && GameState.canStart) {
      startBtn.classList.remove('hidden');
    } else {
      startBtn.classList.add('hidden');
    }

    // Status text
    if (GameState.players.length < 2) {
      statusEl.textContent = 'Need at least 2 players to start';
    } else if (GameState.isCreator) {
      statusEl.textContent = 'Ready to start!';
    } else {
      statusEl.textContent = 'Waiting for host to start...';
    }
  },

  /**
   * Update game screen
   */
  updateGame() {
    const state = GameState;
    const phase = state.getPhase();

    // Update info bar
    document.getElementById('game-round').textContent = state.game?.current_round || '-';
    document.getElementById('game-trick').textContent =
      `${state.game?.trick_number || 0}/${state.game?.current_round || 7}`;

    // Update trump display
    const trumpContainer = document.getElementById('trump-card');
    trumpContainer.innerHTML = '';
    if (state.game?.trump_card) {
      trumpContainer.appendChild(Cards.createTrumpDisplay(state.game.trump_card));
    }

    // Update players area
    this.renderPlayersArea();

    // Update trick area
    this.renderTrickArea();

    // Update hand
    this.renderHand();

    // Show/hide bidding UI
    this.updateBiddingUI();
  },

  /**
   * Render players around the table
   */
  renderPlayersArea() {
    const container = document.getElementById('players-area');
    container.innerHTML = '';

    const otherPlayers = GameState.getOtherPlayers();
    const numOthers = otherPlayers.length;

    // Position players around the screen
    // Top: 0, Top-Right: 1, Right: 2, etc.
    const positions = this.getPlayerPositions(numOthers);

    otherPlayers.forEach((player, index) => {
      const div = document.createElement('div');
      div.className = 'player-position';

      // Check if current turn
      const isCurrentTurn = GameState.game?.current_player_index ===
        GameState.players.findIndex(p => p.id === player.id);
      if (isCurrentTurn) div.classList.add('current-turn');

      // Check if disconnected
      if (!player.is_connected) div.classList.add('disconnected');

      // Position
      const pos = positions[index];
      div.style.cssText = pos.style;

      // Player name
      const nameEl = document.createElement('span');
      nameEl.className = 'player-name';
      nameEl.textContent = player.name;
      div.appendChild(nameEl);

      // Card count or bid info
      const infoEl = document.createElement('span');
      infoEl.className = 'player-info';

      if (GameState.getPhase() === 'bidding') {
        infoEl.textContent = player.current_bid !== null ?
          `Bid: ${player.current_bid}` : 'Bidding...';
      } else if (GameState.getPhase() === 'playing') {
        infoEl.textContent = `${player.current_bid || 0} bid, ${player.tricks_won_this_round || 0} won`;
      }
      div.appendChild(infoEl);

      // Card stack
      if (player.card_count > 0) {
        div.appendChild(Cards.createMiniCardStack(player.card_count));
      }

      // Tricks won
      if (player.tricks_won_this_round > 0) {
        div.appendChild(Cards.createTricksWonDisplay(player.tricks_won_this_round));
      }

      container.appendChild(div);
    });
  },

  /**
   * Get positioning for other players
   */
  getPlayerPositions(numPlayers) {
    // Positions based on number of other players
    const positionSets = {
      1: [{ style: 'top: 20%; left: 50%; transform: translateX(-50%);' }],
      2: [
        { style: 'top: 20%; left: 30%; transform: translateX(-50%);' },
        { style: 'top: 20%; left: 70%; transform: translateX(-50%);' }
      ],
      3: [
        { style: 'top: 20%; left: 50%; transform: translateX(-50%);' },
        { style: 'top: 40%; left: 15%;' },
        { style: 'top: 40%; right: 15%;' }
      ],
      4: [
        { style: 'top: 15%; left: 30%; transform: translateX(-50%);' },
        { style: 'top: 15%; left: 70%; transform: translateX(-50%);' },
        { style: 'top: 45%; left: 10%;' },
        { style: 'top: 45%; right: 10%;' }
      ],
      5: [
        { style: 'top: 10%; left: 50%; transform: translateX(-50%);' },
        { style: 'top: 20%; left: 20%;' },
        { style: 'top: 20%; right: 20%;' },
        { style: 'top: 45%; left: 10%;' },
        { style: 'top: 45%; right: 10%;' }
      ],
      6: [
        { style: 'top: 10%; left: 35%; transform: translateX(-50%);' },
        { style: 'top: 10%; left: 65%; transform: translateX(-50%);' },
        { style: 'top: 30%; left: 15%;' },
        { style: 'top: 30%; right: 15%;' },
        { style: 'top: 50%; left: 10%;' },
        { style: 'top: 50%; right: 10%;' }
      ]
    };

    return positionSets[numPlayers] || positionSets[1];
  },

  /**
   * Render current trick
   */
  renderTrickArea() {
    const container = document.getElementById('trick-area');
    const trick = GameState.game?.current_trick || [];

    Cards.renderTrick(container, trick, GameState.players);
  },

  /**
   * Render player's hand
   */
  renderHand() {
    const container = document.getElementById('player-hand');
    const hand = Cards.sortCards(GameState.myHand);
    const validCards = GameState.getPhase() === 'playing' && GameState.isMyTurn() ?
      GameState.getValidCards() : null;

    Cards.renderHand(container, hand, {
      onCardClick: (card) => this.handleCardClick(card),
      selectedCard: GameState.selectedCard,
      validCards: validCards,
      dealing: false
    });
  },

  /**
   * Handle card click
   */
  handleCardClick(card) {
    if (GameState.getPhase() !== 'playing' || !GameState.isMyTurn()) {
      return;
    }

    if (!GameState.isCardValid(card)) {
      this.showToast('You must follow suit if able', 'error');
      return;
    }

    // If already selected, play it
    if (GameState.selectedCard &&
        GameState.selectedCard.suit === card.suit &&
        GameState.selectedCard.rank === card.rank) {
      this.playSelectedCard();
    } else {
      GameState.selectCard(card);
      this.renderHand();
    }
  },

  /**
   * Play the selected card
   */
  async playSelectedCard() {
    if (!GameState.selectedCard) return;

    const card = GameState.selectedCard;
    GameState.clearSelection();

    try {
      this.showLoading(true);
      await API.playCard(GameState.roomCode, card);
      // State will be updated via realtime subscription
    } catch (error) {
      this.showToast(error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  },

  /**
   * Update bidding UI
   */
  updateBiddingUI() {
    const biddingUI = document.getElementById('bidding-ui');
    const phase = GameState.getPhase();

    if (phase !== 'bidding' || !GameState.isMyTurn()) {
      biddingUI.classList.add('hidden');
      return;
    }

    biddingUI.classList.remove('hidden');

    const optionsContainer = document.getElementById('bid-options');
    optionsContainer.innerHTML = '';

    const currentRound = GameState.game?.current_round || 7;
    const invalidBids = GameState.getInvalidBids();

    for (let i = 0; i <= currentRound; i++) {
      const btn = document.createElement('button');
      btn.className = 'bid-btn';
      btn.textContent = i;

      if (invalidBids.includes(i)) {
        btn.disabled = true;
        btn.title = 'This bid would make total bids equal tricks';
      } else {
        btn.addEventListener('click', () => this.submitBid(i));
      }

      optionsContainer.appendChild(btn);
    }
  },

  /**
   * Submit a bid
   */
  async submitBid(bid) {
    try {
      this.showLoading(true);
      await API.submitBid(GameState.roomCode, bid);
      // State will be updated via realtime subscription
    } catch (error) {
      this.showToast(error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  },

  /**
   * Show round summary
   */
  showRoundSummary(roundScores) {
    const tbody = document.querySelector('#round-scores tbody');
    tbody.innerHTML = '';

    GameState.players.forEach(player => {
      const scoreInfo = roundScores?.find(s => s.id === player.id);
      const tr = document.createElement('tr');

      if (scoreInfo?.madeContract) {
        tr.classList.add('made-contract');
      }

      tr.innerHTML = `
        <td>${player.name}</td>
        <td>${player.current_bid}</td>
        <td>${player.tricks_won_this_round}</td>
        <td>+${scoreInfo?.roundPoints || 0}</td>
        <td>${player.total_score}</td>
      `;

      tbody.appendChild(tr);
    });

    this.showScreen('roundSummary');
  },

  /**
   * Show game end screen
   */
  showGameEnd() {
    // Find winner(s)
    const maxScore = Math.max(...GameState.players.map(p => p.total_score));
    const winners = GameState.players.filter(p => p.total_score === maxScore);

    // Display winner
    const winnerName = document.getElementById('winner-name');
    winnerName.textContent = winners.map(w => w.name).join(' & ');

    // Display final rankings
    const sorted = [...GameState.players].sort((a, b) => b.total_score - a.total_score);
    const tbody = document.querySelector('#final-scores tbody');
    tbody.innerHTML = '';

    let rank = 1;
    let prevScore = null;

    sorted.forEach((player, index) => {
      if (prevScore !== null && player.total_score < prevScore) {
        rank = index + 1;
      }
      prevScore = player.total_score;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}</td>
        <td>${player.name}</td>
        <td>${player.total_score}</td>
      `;
      tbody.appendChild(tr);
    });

    this.showScreen('gameEnd');
  },

  /**
   * Show action feedback
   */
  showFeedback(message) {
    const feedback = document.getElementById('action-feedback');
    feedback.textContent = message;
    feedback.classList.remove('hidden');

    setTimeout(() => {
      feedback.classList.add('hidden');
    }, 2000);
  },

  /**
   * Update rejoin section visibility
   */
  updateRejoinSection(hasActiveGame, roomCode) {
    const section = document.getElementById('rejoin-section');
    if (hasActiveGame) {
      section.classList.remove('hidden');
      section.dataset.roomCode = roomCode;
    } else {
      section.classList.add('hidden');
    }
  }
};

window.UI = UI;
