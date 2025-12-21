const { supabase } = require('../_lib/supabase');
const { generateUniqueRoomCode } = require('../_lib/room-code');

module.exports = async function handler(req, res) {
  // Set CORS headers
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
    const { playerName, sessionId } = req.body;

    if (!playerName || !sessionId) {
      return res.status(400).json({ error: 'Player name and session ID required' });
    }

    if (playerName.length > 50) {
      return res.status(400).json({ error: 'Player name too long (max 50 characters)' });
    }

    // Generate unique room code
    const roomCode = await generateUniqueRoomCode(supabase);

    // Create the game
    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({
        room_code: roomCode,
        creator_session_id: sessionId,
        status: 'lobby',
        current_round: 7,
        current_phase: 'waiting',
        dealer_index: 0
      })
      .select()
      .single();

    if (gameError) {
      console.error('Error creating game:', gameError);
      return res.status(500).json({ error: 'Failed to create game' });
    }

    // Add the creator as the first player
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        game_id: game.id,
        name: playerName.trim(),
        session_id: sessionId,
        position: 0,
        is_connected: true
      })
      .select()
      .single();

    if (playerError) {
      console.error('Error adding player:', playerError);
      // Clean up the game if player creation fails
      await supabase.from('games').delete().eq('id', game.id);
      return res.status(500).json({ error: 'Failed to add player to game' });
    }

    return res.status(201).json({
      roomCode,
      gameId: game.id,
      playerId: player.id
    });

  } catch (error) {
    console.error('Create game error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
