const { supabase } = require('../_lib/supabase');
const { getPlayerGameState } = require('../_lib/game-logic');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomCode } = req.query;
    const sessionId = req.headers['x-session-id'];

    if (!roomCode) {
      return res.status(400).json({ error: 'Room code required' });
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required in header' });
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

    // Get all players in the game, ordered by position
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', game.id)
      .order('position', { ascending: true });

    if (playersError) {
      console.error('Error fetching players:', playersError);
      return res.status(500).json({ error: 'Failed to fetch game state' });
    }

    // Update player's last seen and connected status
    const currentPlayer = players.find(p => p.session_id === sessionId);
    if (currentPlayer) {
      await supabase
        .from('players')
        .update({ is_connected: true, last_seen: new Date().toISOString() })
        .eq('id', currentPlayer.id);
    }

    // Return game state (with hands hidden except for requesting player)
    const gameState = getPlayerGameState(game, players, sessionId);

    // Add creator info for lobby
    gameState.isCreator = game.creator_session_id === sessionId;
    gameState.canStart = game.status === 'lobby' &&
                         game.creator_session_id === sessionId &&
                         players.length >= 2 &&
                         players.length <= 7;

    return res.status(200).json(gameState);

  } catch (error) {
    console.error('Get game error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
