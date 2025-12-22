/**
 * Main Game Logic / State Machine for Contract Whist
 *
 * Orchestrates the game flow through phases:
 *   LOBBY → BIDDING → PLAYING → ROUND_END → (repeat) → GAME_END
 *
 * Key Functions:
 *   - startRound(): Deal cards, set trump, begin bidding
 *   - processBid(): Handle bid submission, advance bidding
 *   - processCardPlay(): Handle card play, resolve tricks/rounds
 *   - getPlayerGameState(): Filter game state for a specific player
 *
 * Dependencies: deck.js, bidding.js, tricks.js, scoring.js
 */

const { dealCards, getTrumpCard, sortHand } = require('./deck');
const { validateBid, isBiddingComplete, getNextBidderIndex, getValidBids } = require('./bidding');
const { resolveTrick, validateCardPlay, removeCardFromHand, isTrickComplete, getNextPlayerInTrick } = require('./tricks');
const { calculateRoundScores, determineWinners } = require('./scoring');

/**
 * Start a new round
 * @param {Object} game - Current game state
 * @param {Object[]} players - Players in order
 * @returns {{ game: Object, players: Object[] }}
 */
function startRound(game, players) {
  const numPlayers = players.length;
  const cardsPerPlayer = game.current_round;

  // Deal cards
  const { hands, remainingDeck } = dealCards(numPlayers, cardsPerPlayer);
  const trumpCard = getTrumpCard(remainingDeck);

  // Update players with their hands
  const updatedPlayers = players.map((player, index) => ({
    ...player,
    hand: sortHand(hands[index]),
    current_bid: null,
    tricks_won_this_round: 0
  }));

  // Update game state
  const updatedGame = {
    ...game,
    current_phase: 'bidding',
    trump_suit: trumpCard ? trumpCard.suit : null,
    trump_card: trumpCard,
    deck: remainingDeck,
    current_trick: [],
    trick_number: 0,
    current_player_index: game.dealer_index, // Dealer bids first
    lead_player_index: null
  };

  return { game: updatedGame, players: updatedPlayers };
}

/**
 * Process a bid
 * @param {Object} game - Current game state
 * @param {Object[]} players - Players in order
 * @param {string} playerId - ID of player making bid
 * @param {number} bid - The bid value
 * @returns {{ game: Object, players: Object[], error?: string }}
 */
function processBid(game, players, playerId, bid) {
  if (game.current_phase !== 'bidding') {
    return { game, players, error: 'Not in bidding phase' };
  }

  // Find player
  const playerIndex = players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) {
    return { game, players, error: 'Player not found' };
  }

  // Check if it's their turn
  if (playerIndex !== game.current_player_index) {
    return { game, players, error: 'Not your turn to bid' };
  }

  // Get bids so far
  const bidsSoFar = players
    .filter(p => p.current_bid !== null)
    .map(p => p.current_bid);

  const numPlayers = players.length;
  const isLastBidder = bidsSoFar.length === numPlayers - 1;

  // Validate bid
  const validation = validateBid(bid, game.current_round, bidsSoFar, isLastBidder);
  if (!validation.valid) {
    return { game, players, error: validation.error };
  }

  // Update player's bid
  const updatedPlayers = players.map((p, i) =>
    i === playerIndex ? { ...p, current_bid: bid } : p
  );

  // Check if bidding is complete
  const allBids = updatedPlayers.map(p => p.current_bid);
  const biddingDone = isBiddingComplete(allBids);

  let updatedGame;
  if (biddingDone) {
    // Move to playing phase, dealer leads first trick
    updatedGame = {
      ...game,
      current_phase: 'playing',
      current_player_index: game.dealer_index,
      lead_player_index: game.dealer_index,
      trick_number: 1
    };
  } else {
    // Move to next bidder
    const nextBidder = getNextBidderIndex(game.dealer_index, allBids, numPlayers);
    updatedGame = {
      ...game,
      current_player_index: nextBidder
    };
  }

  return { game: updatedGame, players: updatedPlayers };
}

/**
 * Process a card play
 * @param {Object} game - Current game state
 * @param {Object[]} players - Players in order
 * @param {string} playerId - ID of player
 * @param {Object} card - Card being played
 * @returns {{ game: Object, players: Object[], trickWinner?: string, error?: string }}
 */
function processCardPlay(game, players, playerId, card) {
  if (game.current_phase !== 'playing') {
    return { game, players, error: 'Not in playing phase' };
  }

  // Find player
  const playerIndex = players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) {
    return { game, players, error: 'Player not found' };
  }

  // Check if it's their turn
  if (playerIndex !== game.current_player_index) {
    return { game, players, error: 'Not your turn to play' };
  }

  const player = players[playerIndex];
  const currentTrick = game.current_trick || [];
  const leadSuit = currentTrick.length > 0 ? currentTrick[0].card.suit : null;

  // Validate card play
  const validation = validateCardPlay(card, player.hand, leadSuit);
  if (!validation.valid) {
    return { game, players, error: validation.error };
  }

  // Remove card from hand
  const newHand = removeCardFromHand(player.hand, card);
  const updatedPlayers = players.map((p, i) =>
    i === playerIndex ? { ...p, hand: newHand } : p
  );

  // Add card to trick
  const newTrick = [...currentTrick, { playerId, card }];

  // Check if trick is complete
  const numPlayers = players.length;
  if (isTrickComplete(newTrick, numPlayers)) {
    // Resolve trick
    const winnerId = resolveTrick(newTrick, game.trump_suit);
    const winnerIndex = players.findIndex(p => p.id === winnerId);

    // Update winner's tricks won
    const finalPlayers = updatedPlayers.map((p, i) =>
      i === winnerIndex
        ? { ...p, tricks_won_this_round: p.tricks_won_this_round + 1 }
        : p
    );

    // Check if round is complete
    const tricksPlayed = game.trick_number;
    const totalTricks = game.current_round;

    if (tricksPlayed >= totalTricks) {
      // Round complete
      return handleRoundEnd(game, finalPlayers, winnerId);
    }

    // Start next trick, winner leads
    const updatedGame = {
      ...game,
      current_trick: [],
      trick_number: game.trick_number + 1,
      current_player_index: winnerIndex,
      lead_player_index: winnerIndex
    };

    return { game: updatedGame, players: finalPlayers, trickWinner: winnerId };
  }

  // Trick not complete, next player's turn
  const nextPlayer = getNextPlayerInTrick(game.lead_player_index, newTrick.length, numPlayers);
  const updatedGame = {
    ...game,
    current_trick: newTrick,
    current_player_index: nextPlayer
  };

  return { game: updatedGame, players: updatedPlayers };
}

/**
 * Handle end of round
 */
function handleRoundEnd(game, players, lastTrickWinnerId) {
  // Calculate scores
  const scoreData = players.map(p => ({
    id: p.id,
    tricksWon: p.tricks_won_this_round,
    bid: p.current_bid,
    totalScore: p.total_score
  }));

  const roundScores = calculateRoundScores(scoreData);

  // Update player total scores
  const updatedPlayers = players.map(p => {
    const scoreInfo = roundScores.find(s => s.id === p.id);
    return {
      ...p,
      total_score: scoreInfo.newTotalScore
    };
  });

  // Check if game is over (just finished round 1)
  if (game.current_round === 1) {
    const updatedGame = {
      ...game,
      current_phase: 'game_end',
      status: 'finished',
      current_trick: []
    };
    return { game: updatedGame, players: updatedPlayers, roundScores, trickWinner: lastTrickWinnerId };
  }

  // Prepare for next round
  const numPlayers = players.length;
  const nextDealerIndex = (game.dealer_index + 1) % numPlayers;

  const updatedGame = {
    ...game,
    current_round: game.current_round - 1,
    current_phase: 'round_end',
    dealer_index: nextDealerIndex,
    current_trick: []
  };

  return { game: updatedGame, players: updatedPlayers, roundScores, trickWinner: lastTrickWinnerId };
}

/**
 * Get game state for a specific player (hides other players' hands)
 */
function getPlayerGameState(game, players, sessionId) {
  const currentPlayer = players.find(p => p.session_id === sessionId);

  return {
    game: {
      room_code: game.room_code,
      status: game.status,
      current_round: game.current_round,
      current_phase: game.current_phase,
      dealer_index: game.dealer_index,
      current_player_index: game.current_player_index,
      trump_suit: game.trump_suit,
      trump_card: game.trump_card,
      current_trick: game.current_trick,
      trick_number: game.trick_number,
      lead_player_index: game.lead_player_index,
      round_scores: game.round_scores || null
    },
    players: players.map(p => ({
      id: p.id,
      name: p.name,
      position: p.position,
      current_bid: p.current_bid,
      tricks_won_this_round: p.tricks_won_this_round,
      total_score: p.total_score,
      is_connected: p.is_connected,
      is_current_player: p.id === (currentPlayer?.id),
      card_count: p.hand?.length || 0
    })),
    myHand: currentPlayer?.hand || [],
    myId: currentPlayer?.id,
    myPosition: currentPlayer?.position
  };
}

/**
 * Check if a player can start the game
 */
function canStartGame(game, players, sessionId) {
  if (game.status !== 'lobby') return false;
  if (game.creator_session_id !== sessionId) return false;
  if (players.length < 2 || players.length > 7) return false;
  return true;
}

/**
 * Get valid actions for the current player
 */
function getValidActions(game, players, playerId) {
  if (game.current_phase === 'bidding') {
    const playerIndex = players.findIndex(p => p.id === playerId);
    if (playerIndex !== game.current_player_index) {
      return { type: 'waiting', message: 'Waiting for other players to bid' };
    }

    const bidsSoFar = players.filter(p => p.current_bid !== null).map(p => p.current_bid);
    const isLastBidder = bidsSoFar.length === players.length - 1;
    const validBids = getValidBids(game.current_round, bidsSoFar, isLastBidder);

    return { type: 'bid', validBids };
  }

  if (game.current_phase === 'playing') {
    const playerIndex = players.findIndex(p => p.id === playerId);
    if (playerIndex !== game.current_player_index) {
      return { type: 'waiting', message: 'Waiting for other players to play' };
    }

    const player = players[playerIndex];
    const leadSuit = game.current_trick?.length > 0 ? game.current_trick[0].card.suit : null;

    // Get valid cards
    const { getValidCards } = require('./tricks');
    const validCards = getValidCards(player.hand, leadSuit);

    return { type: 'play', validCards, hand: player.hand };
  }

  return { type: 'none' };
}

module.exports = {
  startRound,
  processBid,
  processCardPlay,
  handleRoundEnd,
  getPlayerGameState,
  canStartGame,
  getValidActions
};
