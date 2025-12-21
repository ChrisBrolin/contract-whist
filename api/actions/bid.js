const { supabase } = require('../_lib/supabase');
const { processBid } = require('../_lib/game-logic');

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
    const { roomCode, bid } = req.body;
    const sessionId = req.headers['x-session-id'];

    if (!roomCode || bid === undefined || !sessionId) {
      return res.status(400).json({ error: 'Room code, bid, and session ID required' });
    }

    const bidValue = parseInt(bid, 10);
    if (isNaN(bidValue)) {
      return res.status(400).json({ error: 'Invalid bid value' });
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

    // Find the bidding player
    const biddingPlayer = players.find(p => p.session_id === sessionId);
    if (!biddingPlayer) {
      return res.status(403).json({ error: 'You are not in this game' });
    }

    // Process the bid
    const result = processBid(game, players, biddingPlayer.id, bidValue);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    // Update game in database
    const { error: updateGameError } = await supabase
      .from('games')
      .update({
        current_phase: result.game.current_phase,
        current_player_index: result.game.current_player_index,
        lead_player_index: result.game.lead_player_index,
        trick_number: result.game.trick_number
      })
      .eq('id', game.id);

    if (updateGameError) {
      console.error('Error updating game:', updateGameError);
      return res.status(500).json({ error: 'Failed to save bid' });
    }

    // Update the player's bid
    const { error: updatePlayerError } = await supabase
      .from('players')
      .update({ current_bid: bidValue })
      .eq('id', biddingPlayer.id);

    if (updatePlayerError) {
      console.error('Error updating player:', updatePlayerError);
      return res.status(500).json({ error: 'Failed to save bid' });
    }

    return res.status(200).json({
      success: true,
      biddingComplete: result.game.current_phase === 'playing'
    });

  } catch (error) {
    console.error('Bid error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
