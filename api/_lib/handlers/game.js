/**
 * Game Action Handlers
 *
 * Handles: start, bid, play, next-round
 * These actions control the game flow during play.
 */

const { supabase } = require('../supabase');
const { startRound, processBid, processCardPlay } = require('../game-logic');

/**
 * Start the game from lobby
 * @param {string} roomCode - 6-character room code
 * @param {string} sessionId - Host's session ID
 * @param {number} startingRound - Initial round number (1-7)
 * @returns {Object} { success: true }
 */
async function handleStart(roomCode, sessionId, startingRound) {
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

  if (game.creator_session_id !== sessionId) {
    return { status: 403, body: { error: 'Only the creator can start' } };
  }

  if (game.status !== 'lobby') {
    return { status: 400, body: { error: 'Game already started' } };
  }

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .order('position', { ascending: true });

  if (players.length < 2 || players.length > 7) {
    return { status: 400, body: { error: 'Need 2-7 players' } };
  }

  // Calculate max starting round based on player count
  const maxCardsPerPlayer = Math.floor(52 / players.length);
  const maxStartingRound = Math.min(7, maxCardsPerPlayer);
  const validStartingRound = Math.min(Math.max(1, parseInt(startingRound) || 7), maxStartingRound);

  const { game: updatedGame, players: updatedPlayers } = startRound({
    ...game,
    status: 'playing',
    current_round: validStartingRound
  }, players);

  // Update game state
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

  // Update player hands
  for (const player of updatedPlayers) {
    await supabase.from('players').update({
      hand: player.hand,
      current_bid: player.current_bid,
      tricks_won_this_round: player.tricks_won_this_round
    }).eq('id', player.id);
  }

  return { status: 200, body: { success: true } };
}

/**
 * Submit a bid
 * @param {string} roomCode - 6-character room code
 * @param {number} bid - Bid value (0 to current_round)
 * @param {string} sessionId - Bidder's session ID
 * @returns {Object} { success: true, biddingComplete: boolean }
 */
async function handleBid(roomCode, bid, sessionId) {
  if (!roomCode || bid === undefined || !sessionId) {
    return { status: 400, body: { error: 'Room code, bid, and session ID required' } };
  }

  const bidValue = parseInt(bid, 10);

  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .single();

  if (!game) {
    return { status: 404, body: { error: 'Game not found' } };
  }

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .order('position', { ascending: true });

  const biddingPlayer = players.find(p => p.session_id === sessionId);
  if (!biddingPlayer) {
    return { status: 403, body: { error: 'Not in game' } };
  }

  const result = processBid(game, players, biddingPlayer.id, bidValue);
  if (result.error) {
    return { status: 400, body: { error: result.error } };
  }

  await supabase.from('games').update({
    current_phase: result.game.current_phase,
    current_player_index: result.game.current_player_index,
    lead_player_index: result.game.lead_player_index,
    trick_number: result.game.trick_number
  }).eq('id', game.id);

  await supabase.from('players').update({ current_bid: bidValue }).eq('id', biddingPlayer.id);

  return {
    status: 200,
    body: { success: true, biddingComplete: result.game.current_phase === 'playing' }
  };
}

/**
 * Play a card
 * @param {string} roomCode - 6-character room code
 * @param {Object} card - { suit, rank }
 * @param {string} sessionId - Player's session ID
 * @returns {Object} { success, trickComplete, roundComplete, gameComplete, etc. }
 */
async function handlePlay(roomCode, card, sessionId) {
  if (!roomCode || !card || !sessionId) {
    return { status: 400, body: { error: 'Room code, card, and session ID required' } };
  }

  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .single();

  if (!game) {
    return { status: 404, body: { error: 'Game not found' } };
  }

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .order('position', { ascending: true });

  const playingPlayer = players.find(p => p.session_id === sessionId);
  if (!playingPlayer) {
    return { status: 403, body: { error: 'Not in game' } };
  }

  const result = processCardPlay(game, players, playingPlayer.id, card);
  if (result.error) {
    return { status: 400, body: { error: result.error } };
  }

  // Build game update
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

  // Store round scores for display
  if (result.roundScores) {
    gameUpdate.round_scores = result.roundScores;
  }

  await supabase.from('games').update(gameUpdate).eq('id', game.id);

  // Update all players
  for (const player of result.players) {
    await supabase.from('players').update({
      hand: player.hand,
      current_bid: player.current_bid,
      tricks_won_this_round: player.tricks_won_this_round,
      total_score: player.total_score
    }).eq('id', player.id);
  }

  // Find trick winner name
  let trickWinnerName = null;
  if (result.trickWinner) {
    const winner = players.find(p => p.id === result.trickWinner);
    trickWinnerName = winner?.name;
  }

  return {
    status: 200,
    body: {
      success: true,
      trickComplete: !!result.trickWinner,
      trickWinner: result.trickWinner,
      trickWinnerName: trickWinnerName,
      roundComplete: !!result.roundScores,
      roundScores: result.roundScores,
      gameComplete: result.game.current_phase === 'game_end'
    }
  };
}

/**
 * Advance to the next round
 * @param {string} roomCode - 6-character room code
 * @param {string} sessionId - Requester's session ID
 * @returns {Object} { success: true }
 */
async function handleNextRound(roomCode, sessionId) {
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

  if (game.current_phase !== 'round_end') {
    return { status: 400, body: { error: 'Not at end of round' } };
  }

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .order('position', { ascending: true });

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
    round_scores: null
  }).eq('id', game.id);

  for (const player of updatedPlayers) {
    await supabase.from('players').update({
      hand: player.hand,
      current_bid: player.current_bid,
      tricks_won_this_round: player.tricks_won_this_round
    }).eq('id', player.id);
  }

  return { status: 200, body: { success: true } };
}

module.exports = {
  handleStart,
  handleBid,
  handlePlay,
  handleNextRound
};
