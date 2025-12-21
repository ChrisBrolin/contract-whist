const { supabase } = require('../_lib/supabase');
const { processCardPlay, startRound } = require('../_lib/game-logic');

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
    const { roomCode, card } = req.body;
    const sessionId = req.headers['x-session-id'];

    if (!roomCode || !card || !sessionId) {
      return res.status(400).json({ error: 'Room code, card, and session ID required' });
    }

    if (!card.suit || !card.rank) {
      return res.status(400).json({ error: 'Invalid card format' });
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

    // Get players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', game.id)
      .order('position', { ascending: true });

    if (playersError) {
      return res.status(500).json({ error: 'Failed to fetch players' });
    }

    // Find the playing player
    const playingPlayer = players.find(p => p.session_id === sessionId);
    if (!playingPlayer) {
      return res.status(403).json({ error: 'You are not in this game' });
    }

    // Process the card play
    const result = processCardPlay(game, players, playingPlayer.id, card);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    // If round ended, we may need to start a new round
    let finalGame = result.game;
    let finalPlayers = result.players;

    if (result.game.current_phase === 'round_end') {
      // Auto-start next round
      const nextRound = startRound(result.game, result.players);
      finalGame = nextRound.game;
      finalPlayers = nextRound.players;
    }

    // Update game in database
    const { error: updateGameError } = await supabase
      .from('games')
      .update({
        status: finalGame.status,
        current_phase: finalGame.current_phase,
        current_round: finalGame.current_round,
        dealer_index: finalGame.dealer_index,
        current_player_index: finalGame.current_player_index,
        trump_suit: finalGame.trump_suit,
        trump_card: finalGame.trump_card,
        deck: finalGame.deck,
        current_trick: finalGame.current_trick,
        trick_number: finalGame.trick_number,
        lead_player_index: finalGame.lead_player_index
      })
      .eq('id', game.id);

    if (updateGameError) {
      console.error('Error updating game:', updateGameError);
      return res.status(500).json({ error: 'Failed to save play' });
    }

    // Update all players
    for (const player of finalPlayers) {
      const { error: updatePlayerError } = await supabase
        .from('players')
        .update({
          hand: player.hand,
          current_bid: player.current_bid,
          tricks_won_this_round: player.tricks_won_this_round,
          total_score: player.total_score
        })
        .eq('id', player.id);

      if (updatePlayerError) {
        console.error('Error updating player:', updatePlayerError);
      }
    }

    const response = {
      success: true,
      trickComplete: !!result.trickWinner,
      trickWinner: result.trickWinner,
      roundComplete: result.roundScores ? true : false,
      roundScores: result.roundScores,
      gameComplete: finalGame.current_phase === 'game_end',
      newRoundStarted: result.game.current_phase === 'round_end' && finalGame.current_phase === 'bidding'
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Play error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
