/**
 * Supabase Realtime Subscriptions
 */

const Realtime = {
  channel: null,
  pollingInterval: null,
  refreshDebounceTimer: null,
  pendingRefresh: false,

  /**
   * Subscribe to game updates (non-blocking)
   */
  subscribe(roomCode) {
    const supabase = SupabaseClient.get();

    if (!supabase) {
      // Fallback to polling if no realtime
      console.log('Supabase not initialized, using polling');
      this.startPolling(roomCode);
      return;
    }

    // Unsubscribe from previous channel (fire and forget)
    if (this.channel) {
      this.unsubscribe();
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to game channel');
          // Track presence (fire and forget, don't await)
          this.channel.track({
            sessionId: API.getSessionId(),
            online_at: new Date().toISOString()
          });
        }
      });
  },

  /**
   * Unsubscribe from updates
   */
  unsubscribe() {
    if (this.channel) {
      const supabase = SupabaseClient.get();
      if (supabase) {
        supabase.removeChannel(this.channel);
      }
      this.channel = null;
    }

    // Clear debounce timer
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
      this.refreshDebounceTimer = null;
    }

    this.stopPolling();
  },

  /**
   * Handle game table change
   */
  handleGameChange(payload) {
    this.debouncedRefresh();
  },

  /**
   * Handle player table change
   */
  handlePlayerChange(payload) {
    // Check if it's for our game
    if (payload.new?.game_id === GameState.gameId ||
        payload.old?.game_id === GameState.gameId) {
      this.debouncedRefresh();
    }
  },

  /**
   * Debounced refresh - prevents multiple rapid refreshes
   */
  debouncedRefresh() {
    // Clear any pending refresh
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
    }

    // Schedule refresh after 150ms of no new events
    this.refreshDebounceTimer = setTimeout(() => {
      this.refreshDebounceTimer = null;
      this.refreshGameState();
    }, 150);
  },

  /**
   * Refresh game state from server
   */
  async refreshGameState() {
    if (!GameState.roomCode) return;

    // Prevent concurrent refreshes
    if (this.pendingRefresh) return;
    this.pendingRefresh = true;

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
    } finally {
      this.pendingRefresh = false;
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
