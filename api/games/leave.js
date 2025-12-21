const { supabase } = require('../_lib/supabase');

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

    // Find the player
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', game.id)
      .eq('session_id', sessionId)
      .single();

    if (playerError || !player) {
      return res.status(404).json({ error: 'Player not found in game' });
    }

    if (game.status === 'lobby') {
      // In lobby: completely remove player
      await supabase
        .from('players')
        .delete()
        .eq('id', player.id);

      // If creator leaves, delete the game
      if (game.creator_session_id === sessionId) {
        await supabase
          .from('games')
          .delete()
          .eq('id', game.id);

        return res.status(200).json({
          success: true,
          message: 'Game deleted (creator left)',
          gameDeleted: true
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Left game'
      });
    } else {
      // Game in progress: just mark as disconnected
      await supabase
        .from('players')
        .update({
          is_connected: false,
          last_seen: new Date().toISOString()
        })
        .eq('id', player.id);

      return res.status(200).json({
        success: true,
        message: 'Disconnected from game (can rejoin)'
      });
    }

  } catch (error) {
    console.error('Leave game error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
