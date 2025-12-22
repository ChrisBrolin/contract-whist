const { supabase } = require('./_lib/supabase');
const { generateUniqueRoomCode } = require('./_lib/room-code');
const { startRound, getPlayerGameState } = require('./_lib/game-logic');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const sessionId = req.headers['x-session-id'];
  const { action, roomCode, playerName, playerId, bid, card, startingRound } = { ...req.query, ...req.body };

  try {
    switch (action) {
      case 'create':
        return await handleCreate(req, res, playerName, sessionId);
      case 'join':
        return await handleJoin(req, res, roomCode, playerName, sessionId);
      case 'get':
        return await handleGet(req, res, roomCode, sessionId);
      case 'start':
        return await handleStart(req, res, roomCode, sessionId, startingRound);
      case 'leave':
        return await handleLeave(req, res, roomCode, sessionId);
      case 'bid':
        return await handleBid(req, res, roomCode, bid, sessionId);
      case 'play':
        return await handlePlay(req, res, roomCode, card, sessionId);
      case 'next-round':
        return await handleNextRound(req, res, roomCode, sessionId);
      case 'remove-player':
        return await handleRemovePlayer(req, res, roomCode, playerId, sessionId);
      case 'active':
        return await handleActiveGame(req, res, sessionId);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

async function handleCreate(req, res, playerName, sessionId) {
  if (!playerName || !sessionId) {
    return res.status(400).json({ error: 'Player name and session ID required' });
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
    return res.status(500).json({ error: 'Failed to create game' });
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
    return res.status(500).json({ error: 'Failed to add player' });
  }

  // Return full game state to avoid a second API call
  const gameState = getPlayerGameState(game, [player], sessionId);
  gameState.isCreator = true;
  gameState.canStart = false; // Need 2+ players

  return res.status(201).json({
    roomCode,
    gameId: game.id,
    playerId: player.id,
    state: gameState
  });
}

async function handleJoin(req, res, roomCode, playerName, sessionId) {
  if (!roomCode || !playerName || !sessionId) {
    return res.status(400).json({ error: 'Room code, player name, and session ID required' });
  }

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

    // Fetch all players for state
    const { data: allPlayers } = await supabase
      .from('players')
      .select('*')
      .eq('game_id', game.id)
      .order('position', { ascending: true });

    const gameState = getPlayerGameState(game, allPlayers, sessionId);
    gameState.isCreator = game.creator_session_id === sessionId;
    gameState.canStart = game.status === 'lobby' && game.creator_session_id === sessionId && allPlayers.length >= 2 && allPlayers.length <= 7;

    return res.status(200).json({
      roomCode: game.room_code,
      gameId: game.id,
      playerId: existingPlayer.id,
      rejoined: true,
      state: gameState
    });
  }

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .order('position', { ascending: true });

  if (players.length >= 7) {
    return res.status(400).json({ error: 'Game is full' });
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
    return res.status(500).json({ error: 'Failed to join game' });
  }

  // Return full game state to avoid a second API call
  const allPlayers = [...players, player];
  const gameState = getPlayerGameState(game, allPlayers, sessionId);
  gameState.isCreator = game.creator_session_id === sessionId;
  gameState.canStart = game.status === 'lobby' && game.creator_session_id === sessionId && allPlayers.length >= 2 && allPlayers.length <= 7;

  return res.status(200).json({
    roomCode: game.room_code,
    gameId: game.id,
    playerId: player.id,
    state: gameState
  });
}

async function handleGet(req, res, roomCode, sessionId) {
  if (!roomCode || !sessionId) {
    return res.status(400).json({ error: 'Room code and session ID required' });
  }

  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .single();

  if (gameError || !game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .order('position', { ascending: true });

  if (playersError) {
    return res.status(500).json({ error: 'Failed to fetch game state' });
  }

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

  return res.status(200).json(gameState);
}

async function handleStart(req, res, roomCode, sessionId, startingRound) {
  if (!roomCode || !sessionId) {
    return res.status(400).json({ error: 'Room code and session ID required' });
  }

  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .single();

  if (gameError || !game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  if (game.creator_session_id !== sessionId) {
    return res.status(403).json({ error: 'Only the creator can start' });
  }

  if (game.status !== 'lobby') {
    return res.status(400).json({ error: 'Game already started' });
  }

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .order('position', { ascending: true });

  if (players.length < 2 || players.length > 7) {
    return res.status(400).json({ error: 'Need 2-7 players' });
  }

  // Validate starting round (default to 7, max based on player count)
  const maxCardsPerPlayer = Math.floor(52 / players.length);
  const maxStartingRound = Math.min(7, maxCardsPerPlayer);
  const validStartingRound = Math.min(Math.max(1, parseInt(startingRound) || 7), maxStartingRound);

  const { game: updatedGame, players: updatedPlayers } = startRound({
    ...game,
    status: 'playing',
    current_round: validStartingRound
  }, players);

  await supabase.from('games').update({
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
  }).eq('id', game.id);

  for (const player of updatedPlayers) {
    await supabase.from('players').update({
      hand: player.hand,
      current_bid: player.current_bid,
      tricks_won_this_round: player.tricks_won_this_round
    }).eq('id', player.id);
  }

  return res.status(200).json({ success: true });
}

async function handleLeave(req, res, roomCode, sessionId) {
  if (!roomCode || !sessionId) {
    return res.status(400).json({ error: 'Room code and session ID required' });
  }

  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .single();

  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .eq('session_id', sessionId)
    .single();

  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }

  if (game.status === 'lobby') {
    await supabase.from('players').delete().eq('id', player.id);
    if (game.creator_session_id === sessionId) {
      await supabase.from('games').delete().eq('id', game.id);
      return res.status(200).json({ success: true, gameDeleted: true });
    }
  } else {
    await supabase.from('players').update({ is_connected: false, last_seen: new Date().toISOString() }).eq('id', player.id);
  }

  return res.status(200).json({ success: true });
}

async function handleBid(req, res, roomCode, bid, sessionId) {
  const { processBid } = require('./_lib/game-logic');

  if (!roomCode || bid === undefined || !sessionId) {
    return res.status(400).json({ error: 'Room code, bid, and session ID required' });
  }

  const bidValue = parseInt(bid, 10);

  const { data: game } = await supabase.from('games').select('*').eq('room_code', roomCode.toUpperCase()).single();
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const { data: players } = await supabase.from('players').select('*').eq('game_id', game.id).order('position', { ascending: true });
  const biddingPlayer = players.find(p => p.session_id === sessionId);
  if (!biddingPlayer) return res.status(403).json({ error: 'Not in game' });

  const result = processBid(game, players, biddingPlayer.id, bidValue);
  if (result.error) return res.status(400).json({ error: result.error });

  await supabase.from('games').update({
    current_phase: result.game.current_phase,
    current_player_index: result.game.current_player_index,
    lead_player_index: result.game.lead_player_index,
    trick_number: result.game.trick_number
  }).eq('id', game.id);

  await supabase.from('players').update({ current_bid: bidValue }).eq('id', biddingPlayer.id);

  return res.status(200).json({ success: true, biddingComplete: result.game.current_phase === 'playing' });
}

async function handlePlay(req, res, roomCode, card, sessionId) {
  const { processCardPlay } = require('./_lib/game-logic');

  if (!roomCode || !card || !sessionId) {
    return res.status(400).json({ error: 'Room code, card, and session ID required' });
  }

  const { data: game } = await supabase.from('games').select('*').eq('room_code', roomCode.toUpperCase()).single();
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const { data: players } = await supabase.from('players').select('*').eq('game_id', game.id).order('position', { ascending: true });
  const playingPlayer = players.find(p => p.session_id === sessionId);
  if (!playingPlayer) return res.status(403).json({ error: 'Not in game' });

  const result = processCardPlay(game, players, playingPlayer.id, card);
  if (result.error) return res.status(400).json({ error: result.error });

  // Store round scores in game state if round ended (don't auto-advance)
  const gameUpdate = {
    status: result.game.status,
    current_phase: result.game.current_phase,
    current_round: result.game.current_round,
    dealer_index: result.game.dealer_index,
    current_player_index: result.game.current_player_index,
    trump_suit: result.game.trump_suit,
    trump_card: result.game.trump_card,
    deck: result.game.deck,
    current_trick: result.game.current_trick,
    trick_number: result.game.trick_number,
    lead_player_index: result.game.lead_player_index
  };

  // If round ended, store the round scores for display
  if (result.roundScores) {
    gameUpdate.round_scores = result.roundScores;
  }

  await supabase.from('games').update(gameUpdate).eq('id', game.id);

  for (const player of result.players) {
    await supabase.from('players').update({
      hand: player.hand,
      current_bid: player.current_bid,
      tricks_won_this_round: player.tricks_won_this_round,
      total_score: player.total_score
    }).eq('id', player.id);
  }

  // Find trick winner name if trick completed
  let trickWinnerName = null;
  if (result.trickWinner) {
    const winner = players.find(p => p.id === result.trickWinner);
    trickWinnerName = winner?.name;
  }

  return res.status(200).json({
    success: true,
    trickComplete: !!result.trickWinner,
    trickWinner: result.trickWinner,
    trickWinnerName: trickWinnerName,
    roundComplete: !!result.roundScores,
    roundScores: result.roundScores,
    gameComplete: result.game.current_phase === 'game_end'
  });
}

async function handleNextRound(req, res, roomCode, sessionId) {
  const { startRound } = require('./_lib/game-logic');

  if (!roomCode || !sessionId) {
    return res.status(400).json({ error: 'Room code and session ID required' });
  }

  const { data: game } = await supabase.from('games').select('*').eq('room_code', roomCode.toUpperCase()).single();
  if (!game) return res.status(404).json({ error: 'Game not found' });

  if (game.current_phase !== 'round_end') {
    return res.status(400).json({ error: 'Not at end of round' });
  }

  const { data: players } = await supabase.from('players').select('*').eq('game_id', game.id).order('position', { ascending: true });

  // Start the next round
  const { game: updatedGame, players: updatedPlayers } = startRound(game, players);

  await supabase.from('games').update({
    current_phase: updatedGame.current_phase,
    current_player_index: updatedGame.current_player_index,
    trump_suit: updatedGame.trump_suit,
    trump_card: updatedGame.trump_card,
    deck: updatedGame.deck,
    current_trick: updatedGame.current_trick,
    trick_number: updatedGame.trick_number,
    lead_player_index: updatedGame.lead_player_index,
    round_scores: null  // Clear round scores
  }).eq('id', game.id);

  for (const player of updatedPlayers) {
    await supabase.from('players').update({
      hand: player.hand,
      current_bid: player.current_bid,
      tricks_won_this_round: player.tricks_won_this_round
    }).eq('id', player.id);
  }

  return res.status(200).json({ success: true });
}

async function handleRemovePlayer(req, res, roomCode, playerId, sessionId) {
  if (!roomCode || !playerId || !sessionId) {
    return res.status(400).json({ error: 'Room code, player ID, and session ID required' });
  }

  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .single();

  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  // Only creator can remove players
  if (game.creator_session_id !== sessionId) {
    return res.status(403).json({ error: 'Only the host can remove players' });
  }

  // Can only remove players in lobby
  if (game.status !== 'lobby') {
    return res.status(400).json({ error: 'Cannot remove players after game started' });
  }

  // Find the player to remove
  const { data: playerToRemove } = await supabase
    .from('players')
    .select('*')
    .eq('id', playerId)
    .eq('game_id', game.id)
    .single();

  if (!playerToRemove) {
    return res.status(404).json({ error: 'Player not found' });
  }

  // Cannot remove yourself (the host)
  if (playerToRemove.session_id === sessionId) {
    return res.status(400).json({ error: 'Cannot remove yourself' });
  }

  // Delete the player
  await supabase.from('players').delete().eq('id', playerId);

  return res.status(200).json({ success: true });
}

async function handleActiveGame(req, res, sessionId) {
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required' });
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
    return res.status(200).json({ hasActiveGame: false });
  }

  await supabase.from('players').update({ is_connected: true, last_seen: new Date().toISOString() }).eq('id', player.id);

  return res.status(200).json({
    hasActiveGame: true,
    roomCode: player.games.room_code,
    gameId: player.games.id,
    playerId: player.id,
    playerName: player.name,
    gameStatus: player.games.status,
    gamePhase: player.games.current_phase
  });
}
