const { supabase } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomCode, playerName, sessionId } = req.body;

    if (!roomCode || !playerName || !sessionId) {
      return res.status(400).json({ error: 'Room code, player name, and session ID required' });
    }

    if (playerName.length > 50) {
      return res.status(400).json({ error: 'Player name too long (max 50 characters)' });
    }

    // Find the game
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('room_code', roomCode.toUpperCase())
      .single();

    if (gameError || !game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    if (game.status !== 'lobby') {
      return res.status(400).json({ error: 'Game has already started' });
    }

    // Check if player is already in this game
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', game.id)
      .eq('session_id', sessionId)
      .single();

    if (existingPlayer) {
      // Player is rejoining
      await supabase
        .from('players')
        .update({ is_connected: true, last_seen: new Date().toISOString() })
        .eq('id', existingPlayer.id);

      return res.status(200).json({
        roomCode: game.room_code,
        gameId: game.id,
        playerId: existingPlayer.id,
        rejoined: true
      });
    }

    // Get current player count
    const { data: players, error: countError } = await supabase
      .from('players')
      .select('position')
      .eq('game_id', game.id)
      .order('position', { ascending: false });

    if (countError) {
      console.error('Error counting players:', countError);
      return res.status(500).json({ error: 'Failed to join game' });
    }

    if (players.length >= 7) {
      return res.status(400).json({ error: 'Game is full (max 7 players)' });
    }

    // Assign next position
    const nextPosition = players.length > 0 ? players[0].position + 1 : 0;

    // Add the player
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        game_id: game.id,
        name: playerName.trim(),
        session_id: sessionId,
        position: nextPosition,
        is_connected: true
      })
      .select()
      .single();

    if (playerError) {
      console.error('Error adding player:', playerError);
      return res.status(500).json({ error: 'Failed to join game' });
    }

    return res.status(200).json({
      roomCode: game.room_code,
      gameId: game.id,
      playerId: player.id
    });

  } catch (error) {
    console.error('Join game error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
