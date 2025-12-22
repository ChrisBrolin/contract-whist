/**
 * Room Management Handlers
 *
 * Handles: create, join, get, leave
 * These actions manage the game room lifecycle.
 */

const { supabase } = require('../supabase');
const { generateUniqueRoomCode } = require('../room-code');
const { getPlayerGameState } = require('../game-logic');

/**
 * Create a new game room
 * @param {string} playerName - Creator's display name
 * @param {string} sessionId - Creator's session ID
 * @returns {Object} { roomCode, gameId, playerId, state }
 */
async function handleCreate(playerName, sessionId) {
  if (!playerName || !sessionId) {
    return { status: 400, body: { error: 'Player name and session ID required' } };
  }

  const roomCode = await generateUniqueRoomCode(supabase);

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
    return { status: 500, body: { error: 'Failed to create game' } };
  }

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
    await supabase.from('games').delete().eq('id', game.id);
    return { status: 500, body: { error: 'Failed to add player' } };
  }

  const gameState = getPlayerGameState(game, [player], sessionId);
  gameState.isCreator = true;
  gameState.canStart = false;

  return {
    status: 201,
    body: {
      roomCode,
      gameId: game.id,
      playerId: player.id,
      state: gameState
    }
  };
}

/**
 * Join an existing game room
 * @param {string} roomCode - 6-character room code
 * @param {string} playerName - Joiner's display name
 * @param {string} sessionId - Joiner's session ID
 * @returns {Object} { roomCode, gameId, playerId, state, rejoined? }
 */
async function handleJoin(roomCode, playerName, sessionId) {
  if (!roomCode || !playerName || !sessionId) {
    return { status: 400, body: { error: 'Room code, player name, and session ID required' } };
  }

  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .single();

  if (gameError || !game) {
    return { status: 404, body: { error: 'Game not found' } };
  }

  if (game.status !== 'lobby') {
    return { status: 400, body: { error: 'Game has already started' } };
  }

  // Check for existing player (rejoin case)
  const { data: existingPlayer } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .eq('session_id', sessionId)
    .single();

  if (existingPlayer) {
    await supabase
      .from('players')
      .update({ is_connected: true, last_seen: new Date().toISOString() })
      .eq('id', existingPlayer.id);

    const { data: allPlayers } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', game.id)
      .order('position', { ascending: true });

    const gameState = getPlayerGameState(game, allPlayers, sessionId);
    gameState.isCreator = game.creator_session_id === sessionId;
    gameState.canStart = game.status === 'lobby' && game.creator_session_id === sessionId && allPlayers.length >= 2 && allPlayers.length <= 7;

    return {
      status: 200,
      body: {
        roomCode: game.room_code,
        gameId: game.id,
        playerId: existingPlayer.id,
        rejoined: true,
        state: gameState
      }
    };
  }

  // New player joining
  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .order('position', { ascending: true });

  if (players.length >= 7) {
    return { status: 400, body: { error: 'Game is full' } };
  }

  const nextPosition = players.length > 0 ? players[players.length - 1].position + 1 : 0;

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
    return { status: 500, body: { error: 'Failed to join game' } };
  }

  const allPlayers = [...players, player];
  const gameState = getPlayerGameState(game, allPlayers, sessionId);
  gameState.isCreator = game.creator_session_id === sessionId;
  gameState.canStart = game.status === 'lobby' && game.creator_session_id === sessionId && allPlayers.length >= 2 && allPlayers.length <= 7;

  return {
    status: 200,
    body: {
      roomCode: game.room_code,
      gameId: game.id,
      playerId: player.id,
      state: gameState
    }
  };
}

/**
 * Get current game state
 * @param {string} roomCode - 6-character room code
 * @param {string} sessionId - Requester's session ID
 * @returns {Object} Full game state filtered for this player
 */
async function handleGet(roomCode, sessionId) {
  if (!roomCode || !sessionId) {
    return { status: 400, body: { error: 'Room code and session ID required' } };
  }

  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .single();

  if (gameError || !game) {
    return { status: 404, body: { error: 'Game not found' } };
  }

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .order('position', { ascending: true });

  if (playersError) {
    return { status: 500, body: { error: 'Failed to fetch game state' } };
  }

  // Update connection status
  const currentPlayer = players.find(p => p.session_id === sessionId);
  if (currentPlayer) {
    await supabase
      .from('players')
      .update({ is_connected: true, last_seen: new Date().toISOString() })
      .eq('id', currentPlayer.id);
  }

  const gameState = getPlayerGameState(game, players, sessionId);
  gameState.isCreator = game.creator_session_id === sessionId;
  gameState.canStart = game.status === 'lobby' && game.creator_session_id === sessionId && players.length >= 2 && players.length <= 7;

  return { status: 200, body: gameState };
}

/**
 * Leave a game
 * @param {string} roomCode - 6-character room code
 * @param {string} sessionId - Leaver's session ID
 * @returns {Object} { success: true, gameDeleted?: boolean }
 */
async function handleLeave(roomCode, sessionId) {
  if (!roomCode || !sessionId) {
    return { status: 400, body: { error: 'Room code and session ID required' } };
  }

  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .single();

  if (!game) {
    return { status: 404, body: { error: 'Game not found' } };
  }

  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .eq('session_id', sessionId)
    .single();

  if (!player) {
    return { status: 404, body: { error: 'Player not found' } };
  }

  if (game.status === 'lobby') {
    await supabase.from('players').delete().eq('id', player.id);
    if (game.creator_session_id === sessionId) {
      await supabase.from('games').delete().eq('id', game.id);
      return { status: 200, body: { success: true, gameDeleted: true } };
    }
  } else {
    await supabase.from('players').update({ is_connected: false, last_seen: new Date().toISOString() }).eq('id', player.id);
  }

  return { status: 200, body: { success: true } };
}

module.exports = {
  handleCreate,
  handleJoin,
  handleGet,
  handleLeave
};
