const { supabase } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = req.headers['x-session-id'];

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required in header' });
    }

    // Find any active game this player is in
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select(`
        id,
        game_id,
        name,
        position,
        games (
          id,
          room_code,
          status,
          current_phase
        )
      `)
      .eq('session_id', sessionId)
      .not('games.status', 'in', '("finished","abandoned")')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (playerError || !player || !player.games) {
      return res.status(200).json({
        hasActiveGame: false
      });
    }

    const game = player.games;

    // Update player's connection status
    await supabase
      .from('players')
      .update({
        is_connected: true,
        last_seen: new Date().toISOString()
      })
      .eq('id', player.id);

    return res.status(200).json({
      hasActiveGame: true,
      roomCode: game.room_code,
      gameId: game.id,
      playerId: player.id,
      playerName: player.name,
      gameStatus: game.status,
      gamePhase: game.current_phase
    });

  } catch (error) {
    console.error('Check active game error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
