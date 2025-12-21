const { supabase } = require('../_lib/supabase');
const { startRound } = require('../_lib/game-logic');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomCode } = req.body;
    const sessionId = req.headers['x-session-id'];

    if (!roomCode || !sessionId) {
      return res.status(400).json({ error: 'Room code and session ID required' });
    }

    // Get the game
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('room_code', roomCode.toUpperCase())
      .single();

    if (gameError || !game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Verify creator
    if (game.creator_session_id !== sessionId) {
      return res.status(403).json({ error: 'Only the game creator can start the game' });
    }

    if (game.status !== 'lobby') {
      return res.status(400).json({ error: 'Game has already started' });
    }

    // Get players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', game.id)
      .order('position', { ascending: true });

    if (playersError) {
      return res.status(500).json({ error: 'Failed to fetch players' });
    }

    if (players.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 players to start' });
    }

    if (players.length > 7) {
      return res.status(400).json({ error: 'Too many players (max 7)' });
    }

    // Start the first round
    const { game: updatedGame, players: updatedPlayers } = startRound(
      { ...game, status: 'playing' },
      players
    );

    // Update game in database
    const { error: updateGameError } = await supabase
      .from('games')
      .update({
        status: updatedGame.status,
        current_phase: updatedGame.current_phase,
        current_round: updatedGame.current_round,
        dealer_index: updatedGame.dealer_index,
        current_player_index: updatedGame.current_player_index,
        trump_suit: updatedGame.trump_suit,
        trump_card: updatedGame.trump_card,
        deck: updatedGame.deck,
        current_trick: updatedGame.current_trick,
        trick_number: updatedGame.trick_number,
        lead_player_index: updatedGame.lead_player_index
      })
      .eq('id', game.id);

    if (updateGameError) {
      console.error('Error updating game:', updateGameError);
      return res.status(500).json({ error: 'Failed to start game' });
    }

    // Update each player with their hand
    for (const player of updatedPlayers) {
      const { error: updatePlayerError } = await supabase
        .from('players')
        .update({
          hand: player.hand,
          current_bid: player.current_bid,
          tricks_won_this_round: player.tricks_won_this_round
        })
        .eq('id', player.id);

      if (updatePlayerError) {
        console.error('Error updating player:', updatePlayerError);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Game started'
    });

  } catch (error) {
    console.error('Start game error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
