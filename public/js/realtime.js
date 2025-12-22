/**
 * Supabase Realtime Subscriptions
 */

const Realtime = {
  channel: null,
  pollingInterval: null,

  /**
   * Subscribe to game updates
   */
  async subscribe(roomCode) {
    const supabase = SupabaseClient.get();

    if (!supabase) {
      // Fallback to polling if no realtime
      console.log('Supabase not initialized, using polling');
      this.startPolling(roomCode);
      return;
    }

    // Unsubscribe from previous channel
    if (this.channel) {
      await this.unsubscribe();
    }

    // Create channel for this game
    this.channel = supabase.channel(`game:${roomCode}`);

    // Listen for game table changes
    this.channel
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `room_code=eq.${roomCode}` },
        (payload) => this.handleGameChange(payload)
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        (payload) => this.handlePlayerChange(payload)
      )
      .on('presence', { event: 'sync' }, () => this.handlePresenceSync())
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to game channel');
          // Track presence
          await this.channel.track({
            sessionId: API.getSessionId(),
            online_at: new Date().toISOString()
          });
        }
      });
  },

  /**
   * Unsubscribe from updates
   */
  async unsubscribe() {
    if (this.channel) {
      const supabase = SupabaseClient.get();
      if (supabase) {
        await supabase.removeChannel(this.channel);
      }
      this.channel = null;
    }

    this.stopPolling();
  },

  /**
   * Handle game table change
   */
  async handleGameChange(payload) {
    console.log('Game change:', payload);

    // Refresh full game state
    await this.refreshGameState();
  },

  /**
   * Handle player table change
   */
  async handlePlayerChange(payload) {
    console.log('Player change:', payload);

    // Check if it's for our game
    if (payload.new?.game_id === GameState.gameId ||
        payload.old?.game_id === GameState.gameId) {
      await this.refreshGameState();
    }
  },

  /**
   * Handle presence sync
   */
  handlePresenceSync() {
    if (!this.channel) return;

    const state = this.channel.presenceState();
    console.log('Presence sync:', state);

    // Update connected status in UI
    // (handled by full state refresh)
  },

  /**
   * Refresh game state from server
   */
  async refreshGameState() {
    if (!GameState.roomCode) return;

    try {
      const state = await API.getGameState(GameState.roomCode);
      GameState.updateFromServer(state);

      // Update UI based on current phase
      const phase = state.game.current_phase;
      const status = state.game.status;
      const roundScores = state.game.round_scores;

      if (status === 'lobby') {
        UI.updateLobby();
      } else if (status === 'playing') {
        if (phase === 'bidding' || phase === 'playing') {
          UI.showScreen('game');
          UI.updateGame();
        } else if (phase === 'round_end') {
          // Show round summary with scores from game state
          if (UI.currentScreen !== 'roundSummary') {
            UI.showRoundSummary(roundScores);
          }
        } else if (phase === 'game_end') {
          UI.showGameEnd();
        }
      } else if (status === 'finished') {
        UI.showGameEnd();
      }

    } catch (error) {
      console.error('Error refreshing game state:', error);
    }
  },

  /**
   * Start polling (fallback if realtime not available)
   */
  startPolling(roomCode) {
    this.stopPolling();

    this.pollingInterval = setInterval(async () => {
      if (GameState.roomCode === roomCode) {
        await this.refreshGameState();
      } else {
        this.stopPolling();
      }
    }, 2000); // Poll every 2 seconds
  },

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
};

window.Realtime = Realtime;
