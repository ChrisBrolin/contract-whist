/**
 * Player Management Handlers
 *
 * Handles: remove-player, active
 * These actions manage individual player state.
 */

const { supabase } = require('../supabase');

/**
 * Remove a player from the lobby (host only)
 * @param {string} roomCode - 6-character room code
 * @param {string} playerId - ID of player to remove
 * @param {string} sessionId - Host's session ID
 * @returns {Object} { success: true }
 */
async function handleRemovePlayer(roomCode, playerId, sessionId) {
  if (!roomCode || !playerId || !sessionId) {
    return { status: 400, body: { error: 'Room code, player ID, and session ID required' } };
  }

  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .single();

  if (!game) {
    return { status: 404, body: { error: 'Game not found' } };
  }

  // Only creator can remove players
  if (game.creator_session_id !== sessionId) {
    return { status: 403, body: { error: 'Only the host can remove players' } };
  }

  // Can only remove players in lobby
  if (game.status !== 'lobby') {
    return { status: 400, body: { error: 'Cannot remove players after game started' } };
  }

  // Find the player to remove
  const { data: playerToRemove } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .eq('game_id', game.id)
    .single();

  if (!playerToRemove) {
    return { status: 404, body: { error: 'Player not found' } };
  }

  // Cannot remove yourself (the host)
  if (playerToRemove.session_id === sessionId) {
    return { status: 400, body: { error: 'Cannot remove yourself' } };
  }

  // Delete the player
  await supabase.from('players').delete().eq('id', playerId);

  return { status: 200, body: { success: true } };
}

/**
 * Check if player has an active game
 * @param {string} sessionId - Player's session ID
 * @returns {Object} { hasActiveGame, roomCode?, gameId?, etc. }
 */
async function handleActiveGame(sessionId) {
  if (!sessionId) {
    return { status: 400, body: { error: 'Session ID required' } };
  }

  const { data: player } = await supabase
    .from('players')
    .select(`id, game_id, name, position, games (id, room_code, status, current_phase)`)
    .eq('session_id', sessionId)
    .not('games.status', 'in', '("finished","abandoned")')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!player || !player.games) {
    return { status: 200, body: { hasActiveGame: false } };
  }

  // Update connection status
  await supabase
    .from('players')
    .update({ is_connected: true, last_seen: new Date().toISOString() })
    .eq('id', player.id);

  return {
    status: 200,
    body: {
      hasActiveGame: true,
      roomCode: player.games.room_code,
      gameId: player.games.id,
      playerId: player.id,
      playerName: player.name,
      gameStatus: player.games.status,
      gamePhase: player.games.current_phase
    }
  };
}

module.exports = {
  handleRemovePlayer,
  handleActiveGame
};
