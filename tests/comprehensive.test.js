/**
 * Comprehensive Game Tests
 * Tests edge cases, full game simulations, and robustness scenarios
 * Run with: node tests/comprehensive.test.js
 */

const { startRound, processBid, processCardPlay, getPlayerGameState, handleRoundEnd } = require('../api/_lib/game-logic');
const { dealCards, createDeck, shuffleDeck, sortHand, cardsEqual } = require('../api/_lib/deck');
const { validateBid, isBiddingComplete, getValidBids, getNextBidderIndex } = require('../api/_lib/bidding');
const { resolveTrick, validateCardPlay, getValidCards, removeCardFromHand, isTrickComplete, getNextPlayerInTrick } = require('../api/_lib/tricks');
const { calculateRoundScores } = require('../api/_lib/scoring');

let passed = 0;
let failed = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passed++;
    console.log(`    ✓ ${message}`);
  } else {
    failed++;
    console.log(`    ✗ ${message}`);
  }
}

function assertThrows(fn, message) {
  totalTests++;
  try {
    fn();
    failed++;
    console.log(`    ✗ ${message} (should have thrown)`);
  } catch (e) {
    passed++;
    console.log(`    ✓ ${message}`);
  }
}

function test(name, fn) {
  console.log(`\n  ${name}`);
  try {
    fn();
  } catch (e) {
    failed++;
    console.log(`    ✗ Error: ${e.message}`);
    console.log(`      ${e.stack.split('\n')[1]}`);
  }
}

function section(name) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${name}`);
  console.log('='.repeat(60));
}

// ============================================================================
// DECK EDGE CASES
// ============================================================================

section('DECK EDGE CASES');

test('Deck shuffling produces different results', () => {
  const deck1 = shuffleDeck(createDeck());
  const deck2 = shuffleDeck(createDeck());

  // Check that at least some cards are in different positions
  let differences = 0;
  for (let i = 0; i < 52; i++) {
    if (!cardsEqual(deck1[i], deck2[i])) differences++;
  }
  assert(differences > 10, 'Shuffled decks are sufficiently different');
});

test('Deal cards for all player counts (2-7)', () => {
  for (let players = 2; players <= 7; players++) {
    const maxCards = Math.floor(52 / players);
    const { hands, remainingDeck } = dealCards(players, maxCards);

    assert(hands.length === players, `${players} players: correct hand count`);
    assert(hands.every(h => h.length === maxCards), `${players} players: each has ${maxCards} cards`);

    // Verify no duplicate cards
    const allCards = hands.flat();
    const uniqueCards = new Set(allCards.map(c => `${c.suit}-${c.rank}`));
    assert(uniqueCards.size === allCards.length, `${players} players: no duplicate cards`);
  }
});

test('Deal cards - minimum (1 card each)', () => {
  const { hands, remainingDeck } = dealCards(7, 1);
  assert(hands.every(h => h.length === 1), 'Each player has exactly 1 card');
  assert(remainingDeck.length === 45, 'Remaining deck has 45 cards');
});

test('Sort hand orders correctly', () => {
  const unsorted = [
    { suit: 'clubs', rank: 2 },
    { suit: 'hearts', rank: 14 },
    { suit: 'spades', rank: 5 },
    { suit: 'diamonds', rank: 10 },
    { suit: 'spades', rank: 14 },
  ];

  const sorted = sortHand(unsorted);

  // Spades first (14, then 5), then hearts (14), then diamonds, then clubs
  assert(sorted[0].suit === 'spades' && sorted[0].rank === 14, 'Spade Ace first');
  assert(sorted[1].suit === 'spades' && sorted[1].rank === 5, 'Spade 5 second');
  assert(sorted[2].suit === 'hearts', 'Hearts third');
  assert(sorted[4].suit === 'clubs', 'Clubs last');
});

// ============================================================================
// BIDDING EDGE CASES
// ============================================================================

section('BIDDING EDGE CASES');

test('Last bidder restriction - cannot make total equal round number', () => {
  // Rule: Total bids cannot equal the number of tricks in the round
  const scenarios = [
    { round: 7, bidsSoFar: [1, 1, 1, 1, 1, 1], invalidBid: 1 },  // sum=6, bid 1 makes 7
    { round: 7, bidsSoFar: [2, 2, 2, 0, 0, 0], invalidBid: 1 },  // sum=6, bid 1 makes 7
    { round: 7, bidsSoFar: [0, 0, 0, 0, 0, 0], invalidBid: 7 },  // sum=0, bid 7 makes 7
    { round: 5, bidsSoFar: [2, 1, 1], invalidBid: 1 },           // sum=4, bid 1 makes 5
    { round: 3, bidsSoFar: [1, 1], invalidBid: 1 },              // sum=2, bid 1 makes 3
    { round: 1, bidsSoFar: [0], invalidBid: 1 },                 // sum=0, bid 1 makes 1
  ];

  scenarios.forEach((scenario, i) => {
    const validBids = getValidBids(scenario.round, scenario.bidsSoFar, true);
    assert(!validBids.includes(scenario.invalidBid),
      `Scenario ${i+1} (round ${scenario.round}): bid ${scenario.invalidBid} is invalid`);
  });
});

test('Last bidder - at least one valid bid always exists', () => {
  // In any round, there should always be at least one valid bid for last bidder
  for (let round = 1; round <= 7; round++) {
    for (let numPlayers = 2; numPlayers <= 7; numPlayers++) {
      // Generate random bids for all but last player
      const bidsSoFar = [];
      for (let i = 0; i < numPlayers - 1; i++) {
        bidsSoFar.push(Math.floor(Math.random() * (round + 1)));
      }

      const validBids = getValidBids(round, bidsSoFar, true);
      assert(validBids.length > 0,
        `Round ${round}, ${numPlayers} players: at least one valid bid exists`);
    }
  }
});

test('Bidding order follows dealer clockwise', () => {
  const bids = [null, null, null, null];

  // Dealer at index 2
  assert(getNextBidderIndex(2, bids, 4) === 2, 'Dealer bids first (index 2)');

  bids[2] = 1; // Dealer bids
  assert(getNextBidderIndex(2, bids, 4) === 3, 'Next is index 3');

  bids[3] = 2;
  assert(getNextBidderIndex(2, bids, 4) === 0, 'Wraps to index 0');

  bids[0] = 0;
  assert(getNextBidderIndex(2, bids, 4) === 1, 'Finally index 1');

  bids[1] = 1;
  assert(getNextBidderIndex(2, bids, 4) === null, 'Returns null when complete');
});

test('Validate bid rejects invalid types', () => {
  assert(!validateBid('three', 7, [], false).valid, 'Rejects string bid');
  assert(!validateBid(3.5, 7, [], false).valid, 'Rejects float bid');
  assert(!validateBid(null, 7, [], false).valid, 'Rejects null bid');
  assert(!validateBid(undefined, 7, [], false).valid, 'Rejects undefined bid');
  assert(!validateBid(NaN, 7, [], false).valid, 'Rejects NaN bid');
});

// ============================================================================
// TRICK RESOLUTION EDGE CASES
// ============================================================================

section('TRICK RESOLUTION EDGE CASES');

test('Trump beats any lead suit card', () => {
  const trick = [
    { playerId: 'p1', card: { suit: 'hearts', rank: 14 } }, // Ace of hearts (lead)
    { playerId: 'p2', card: { suit: 'spades', rank: 2 } },  // 2 of spades (trump)
  ];

  assert(resolveTrick(trick, 'spades') === 'p2', 'Lowest trump beats highest lead');
});

test('Off-suit card never wins', () => {
  const trick = [
    { playerId: 'p1', card: { suit: 'hearts', rank: 2 } },   // 2 of hearts (lead)
    { playerId: 'p2', card: { suit: 'diamonds', rank: 14 } }, // Ace of diamonds (off-suit)
    { playerId: 'p3', card: { suit: 'clubs', rank: 14 } },    // Ace of clubs (off-suit)
  ];

  assert(resolveTrick(trick, 'spades') === 'p1', 'Lead card wins when others are off-suit');
});

test('Multiple trumps - highest wins', () => {
  const trick = [
    { playerId: 'p1', card: { suit: 'hearts', rank: 14 } },  // Lead
    { playerId: 'p2', card: { suit: 'spades', rank: 10 } },  // Trump
    { playerId: 'p3', card: { suit: 'spades', rank: 11 } },  // Higher trump
    { playerId: 'p4', card: { suit: 'spades', rank: 2 } },   // Lower trump
  ];

  assert(resolveTrick(trick, 'spades') === 'p3', 'Jack of spades (highest trump) wins');
});

test('Lead is trump - highest trump wins', () => {
  const trick = [
    { playerId: 'p1', card: { suit: 'spades', rank: 5 } },
    { playerId: 'p2', card: { suit: 'spades', rank: 14 } },
    { playerId: 'p3', card: { suit: 'spades', rank: 10 } },
  ];

  assert(resolveTrick(trick, 'spades') === 'p2', 'Ace of trump wins');
});

test('Empty trick throws error', () => {
  assertThrows(() => resolveTrick([], 'spades'), 'Empty trick throws error');
});

test('Card validation - must follow suit', () => {
  const hand = [
    { suit: 'hearts', rank: 14 },
    { suit: 'hearts', rank: 2 },
    { suit: 'clubs', rank: 5 },
  ];

  // Can't play clubs when have hearts and hearts was led
  const result = validateCardPlay({ suit: 'clubs', rank: 5 }, hand, 'hearts');
  assert(!result.valid, 'Cannot play clubs when holding hearts');
  assert(result.error.includes('follow suit'), 'Error mentions following suit');
});

test('Card validation - card not in hand', () => {
  const hand = [{ suit: 'hearts', rank: 14 }];
  const result = validateCardPlay({ suit: 'spades', rank: 2 }, hand, null);
  assert(!result.valid, 'Cannot play card not in hand');
});

test('Remove card from hand', () => {
  const hand = [
    { suit: 'hearts', rank: 14 },
    { suit: 'hearts', rank: 13 },
    { suit: 'clubs', rank: 5 },
  ];

  const newHand = removeCardFromHand(hand, { suit: 'hearts', rank: 13 });
  assert(newHand.length === 2, 'Hand has 2 cards after removal');
  assert(!newHand.some(c => c.rank === 13 && c.suit === 'hearts'), 'King of hearts removed');
  assert(hand.length === 3, 'Original hand unchanged');
});

test('Next player in trick calculation', () => {
  // 4 players, lead is index 2
  assert(getNextPlayerInTrick(2, 0, 4) === 2, 'Lead player is first');
  assert(getNextPlayerInTrick(2, 1, 4) === 3, 'Second player');
  assert(getNextPlayerInTrick(2, 2, 4) === 0, 'Third player wraps');
  assert(getNextPlayerInTrick(2, 3, 4) === 1, 'Fourth player');
});

// ============================================================================
// SCORING EDGE CASES
// ============================================================================

section('SCORING EDGE CASES');

test('Perfect game - everyone makes contract', () => {
  const scoreData = [
    { id: 'p1', tricksWon: 2, bid: 2, totalScore: 0 },
    { id: 'p2', tricksWon: 3, bid: 3, totalScore: 0 },
    { id: 'p3', tricksWon: 2, bid: 2, totalScore: 0 },
  ];

  const scores = calculateRoundScores(scoreData);

  assert(scores.every(s => s.madeContract), 'Everyone made contract');
  assert(scores.find(s => s.id === 'p1').roundPoints === 12, 'P1: 2 + 10 = 12');
  assert(scores.find(s => s.id === 'p2').roundPoints === 13, 'P2: 3 + 10 = 13');
});

test('Everyone misses contract', () => {
  const scoreData = [
    { id: 'p1', tricksWon: 1, bid: 3, totalScore: 0 },
    { id: 'p2', tricksWon: 4, bid: 2, totalScore: 0 },
    { id: 'p3', tricksWon: 2, bid: 0, totalScore: 0 },
  ];

  const scores = calculateRoundScores(scoreData);

  assert(scores.every(s => !s.madeContract), 'Everyone missed contract');
  assert(scores.find(s => s.id === 'p1').roundPoints === 1, 'P1 gets tricks only');
  assert(scores.find(s => s.id === 'p2').roundPoints === 4, 'P2 gets tricks only');
  assert(scores.find(s => s.id === 'p3').roundPoints === 2, 'P3 gets tricks only');
});

test('Bid 0 and win 0 - makes contract', () => {
  const scoreData = [
    { id: 'p1', tricksWon: 0, bid: 0, totalScore: 50 },
  ];

  const scores = calculateRoundScores(scoreData);
  assert(scores[0].madeContract, 'Bid 0, won 0 = made contract');
  assert(scores[0].roundPoints === 10, 'Gets 0 + 10 = 10 bonus points');
  assert(scores[0].newTotalScore === 60, 'Total is now 60');
});

test('Score accumulation across rounds', () => {
  const round1 = calculateRoundScores([
    { id: 'p1', tricksWon: 3, bid: 3, totalScore: 0 },
  ]);

  const round2 = calculateRoundScores([
    { id: 'p1', tricksWon: 2, bid: 2, totalScore: round1[0].newTotalScore },
  ]);

  assert(round2[0].newTotalScore === 25, 'Score accumulates: 13 + 12 = 25');
});

// ============================================================================
// GAME FLOW - FULL ROUND SIMULATION
// ============================================================================

section('GAME FLOW - FULL ROUND SIMULATION');

test('Complete round simulation - 3 players, round 3', () => {
  // Setup
  let game = {
    id: 'test-game',
    room_code: 'ABCDEF',
    status: 'playing',
    current_round: 3,
    dealer_index: 0
  };

  let players = [
    { id: 'p1', name: 'Alice', position: 0, total_score: 0 },
    { id: 'p2', name: 'Bob', position: 1, total_score: 0 },
    { id: 'p3', name: 'Carol', position: 2, total_score: 0 },
  ];

  // Start round
  const roundResult = startRound(game, players);
  game = roundResult.game;
  players = roundResult.players;

  assert(game.current_phase === 'bidding', 'Round starts in bidding phase');
  assert(players.every(p => p.hand.length === 3), 'Each player has 3 cards');

  // Bidding phase
  const bid1 = processBid(game, players, 'p1', 1);
  assert(!bid1.error, 'P1 bids 1');
  game = bid1.game;
  players = bid1.players;

  const bid2 = processBid(game, players, 'p2', 1);
  assert(!bid2.error, 'P2 bids 1');
  game = bid2.game;
  players = bid2.players;

  // P3 is last bidder, sum=2, cannot bid 1 (would make total 3)
  const validBidsP3 = getValidBids(3, [1, 1], true);
  const p3Bid = validBidsP3[0]; // Pick first valid bid

  const bid3 = processBid(game, players, 'p3', p3Bid);
  assert(!bid3.error, `P3 bids ${p3Bid}`);
  game = bid3.game;
  players = bid3.players;

  assert(game.current_phase === 'playing', 'Moves to playing phase after bidding');

  // Play all 3 tricks
  for (let trick = 0; trick < 3; trick++) {
    for (let play = 0; play < 3; play++) {
      const currentPlayer = players[game.current_player_index];
      const validCards = getValidCards(
        currentPlayer.hand,
        game.current_trick.length > 0 ? game.current_trick[0].card.suit : null
      );

      const result = processCardPlay(game, players, currentPlayer.id, validCards[0]);
      assert(!result.error, `Trick ${trick+1}, Play ${play+1}: ${currentPlayer.name} plays successfully`);
      game = result.game;
      players = result.players;
    }
  }

  // Round should end
  assert(game.current_phase === 'round_end', 'Phase is round_end after all tricks');
  assert(game.current_round === 2, 'Next round will be round 2');
});

test('Complete game simulation - 2 players, start from round 2', () => {
  let game = {
    id: 'test-game',
    room_code: 'ABCDEF',
    status: 'playing',
    current_round: 2,
    dealer_index: 0
  };

  let players = [
    { id: 'p1', name: 'Alice', position: 0, total_score: 0 },
    { id: 'p2', name: 'Bob', position: 1, total_score: 0 },
  ];

  let roundsPlayed = 0;

  // Play both rounds (2 and 1)
  while (game.status !== 'finished' && roundsPlayed < 10) {
    // Start round - this sets up bidding phase
    const roundResult = startRound(game, players);
    game = roundResult.game;
    players = roundResult.players;

    // Get the actual round number AFTER startRound
    const cardsThisRound = game.current_round;

    // Bidding - P1 bids first (dealer)
    const validBidsP1 = getValidBids(cardsThisRound, [], false);
    const bid1 = processBid(game, players, players[game.current_player_index].id, validBidsP1[0]);
    game = bid1.game;
    players = bid1.players;

    // P2 bids second (last bidder)
    const validBidsP2 = getValidBids(cardsThisRound, [validBidsP1[0]], true);
    const bid2 = processBid(game, players, players[game.current_player_index].id, validBidsP2[0]);
    game = bid2.game;
    players = bid2.players;

    // Play all tricks for this round
    for (let trick = 0; trick < cardsThisRound; trick++) {
      for (let play = 0; play < 2; play++) {
        const currentPlayer = players[game.current_player_index];
        const leadSuit = game.current_trick.length > 0 ? game.current_trick[0].card.suit : null;
        const validCards = getValidCards(currentPlayer.hand, leadSuit);

        const result = processCardPlay(game, players, currentPlayer.id, validCards[0]);
        game = result.game;
        players = result.players;
      }
    }

    roundsPlayed++;
  }

  assert(game.current_phase === 'game_end', 'Game ends after round 1');
  assert(game.status === 'finished', 'Game status is finished');
  assert(roundsPlayed === 2, 'Played exactly 2 rounds');

  // Verify scores are calculated
  const totalScore = players.reduce((sum, p) => sum + p.total_score, 0);
  assert(totalScore > 0, 'Players have scores');
});

// ============================================================================
// STATE MANAGEMENT EDGE CASES
// ============================================================================

section('STATE MANAGEMENT EDGE CASES');

test('getPlayerGameState hides opponent hands', () => {
  const game = {
    room_code: 'ABCDEF',
    status: 'playing',
    current_round: 7,
    current_phase: 'playing',
    dealer_index: 0,
    current_player_index: 0,
    trump_suit: 'hearts',
    trump_card: { suit: 'hearts', rank: 13 },
    current_trick: [{ playerId: 'p2', card: { suit: 'clubs', rank: 10 } }],
    trick_number: 3,
    lead_player_index: 1,
    round_scores: null
  };

  const players = [
    { id: 'p1', session_id: 's1', name: 'Alice', position: 0,
      hand: [{ suit: 'hearts', rank: 14 }, { suit: 'spades', rank: 2 }],
      current_bid: 3, tricks_won_this_round: 2, total_score: 25, is_connected: true },
    { id: 'p2', session_id: 's2', name: 'Bob', position: 1,
      hand: [{ suit: 'diamonds', rank: 5 }],
      current_bid: 2, tricks_won_this_round: 1, total_score: 15, is_connected: true },
  ];

  const stateForP1 = getPlayerGameState(game, players, 's1');

  assert(stateForP1.myHand.length === 2, 'P1 sees own hand');
  assert(stateForP1.myId === 'p1', 'P1 ID correct');
  assert(stateForP1.players[0].card_count === 2, 'P1 card count visible');
  assert(stateForP1.players[1].card_count === 1, 'P2 card count visible');
  assert(!stateForP1.players[0].hand, 'Hands not exposed in player list');
  assert(!stateForP1.players[1].hand, 'Hands not exposed in player list');

  // Verify game info is correct
  assert(stateForP1.game.current_trick.length === 1, 'Current trick visible');
  assert(stateForP1.game.trump_card.rank === 13, 'Trump card visible');
});

test('State includes round_scores when available', () => {
  const game = {
    room_code: 'ABCDEF',
    status: 'playing',
    current_round: 6,
    current_phase: 'round_end',
    dealer_index: 1,
    current_player_index: 0,
    trump_suit: 'spades',
    trump_card: { suit: 'spades', rank: 10 },
    current_trick: [],
    trick_number: 0,
    lead_player_index: null,
    round_scores: [
      { id: 'p1', madeContract: true, roundPoints: 13, newTotalScore: 13 },
      { id: 'p2', madeContract: false, roundPoints: 2, newTotalScore: 2 },
    ]
  };

  const players = [
    { id: 'p1', session_id: 's1', name: 'Alice', position: 0, hand: [],
      current_bid: 3, tricks_won_this_round: 3, total_score: 13, is_connected: true },
    { id: 'p2', session_id: 's2', name: 'Bob', position: 1, hand: [],
      current_bid: 4, tricks_won_this_round: 2, total_score: 2, is_connected: true },
  ];

  const state = getPlayerGameState(game, players, 's1');

  assert(state.game.round_scores !== null, 'Round scores included');
  assert(state.game.round_scores.length === 2, 'Both player scores included');
  assert(state.game.current_phase === 'round_end', 'Phase is round_end');
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

section('ERROR HANDLING');

test('processBid - wrong phase', () => {
  const game = { current_phase: 'playing', current_round: 7 };
  const players = [{ id: 'p1', current_bid: null }];

  const result = processBid(game, players, 'p1', 3);
  assert(result.error === 'Not in bidding phase', 'Returns correct error');
});

test('processBid - wrong player turn', () => {
  const game = { current_phase: 'bidding', current_round: 7, current_player_index: 1, dealer_index: 0 };
  const players = [
    { id: 'p1', current_bid: null },
    { id: 'p2', current_bid: null }
  ];

  const result = processBid(game, players, 'p1', 3); // P1 tries to bid but it's P2's turn
  assert(result.error === 'Not your turn to bid', 'Returns correct error');
});

test('processBid - player not found', () => {
  const game = { current_phase: 'bidding', current_round: 7, current_player_index: 0, dealer_index: 0 };
  const players = [{ id: 'p1', current_bid: null }];

  const result = processBid(game, players, 'nonexistent', 3);
  assert(result.error === 'Player not found', 'Returns correct error');
});

test('processCardPlay - wrong phase', () => {
  const game = { current_phase: 'bidding', current_round: 7 };
  const players = [{ id: 'p1', hand: [{ suit: 'hearts', rank: 14 }] }];

  const result = processCardPlay(game, players, 'p1', { suit: 'hearts', rank: 14 });
  assert(result.error === 'Not in playing phase', 'Returns correct error');
});

test('processCardPlay - wrong player turn', () => {
  const game = {
    current_phase: 'playing',
    current_round: 7,
    current_player_index: 1,
    current_trick: [],
    lead_player_index: 1
  };
  const players = [
    { id: 'p1', hand: [{ suit: 'hearts', rank: 14 }] },
    { id: 'p2', hand: [{ suit: 'spades', rank: 2 }] }
  ];

  const result = processCardPlay(game, players, 'p1', { suit: 'hearts', rank: 14 });
  assert(result.error === 'Not your turn to play', 'Returns correct error');
});

test('processCardPlay - card not in hand', () => {
  const game = {
    current_phase: 'playing',
    current_round: 7,
    current_player_index: 0,
    current_trick: [],
    lead_player_index: 0,
    trump_suit: 'spades'
  };
  const players = [
    { id: 'p1', hand: [{ suit: 'hearts', rank: 14 }], tricks_won_this_round: 0 }
  ];

  const result = processCardPlay(game, players, 'p1', { suit: 'clubs', rank: 2 });
  assert(result.error === 'Card not in hand', 'Returns correct error');
});

test('processCardPlay - must follow suit', () => {
  const game = {
    current_phase: 'playing',
    current_round: 7,
    current_player_index: 0,
    current_trick: [{ playerId: 'p2', card: { suit: 'hearts', rank: 5 } }],
    lead_player_index: 1,
    trump_suit: 'spades'
  };
  const players = [
    { id: 'p1', hand: [{ suit: 'hearts', rank: 14 }, { suit: 'clubs', rank: 2 }], tricks_won_this_round: 0 }
  ];

  const result = processCardPlay(game, players, 'p1', { suit: 'clubs', rank: 2 });
  assert(result.error.includes('follow suit'), 'Must follow suit error');
});

// ============================================================================
// ROUND TRANSITIONS
// ============================================================================

section('ROUND TRANSITIONS');

test('Dealer rotates each round', () => {
  let game = { current_round: 3, dealer_index: 0, status: 'playing' };
  let players = [
    { id: 'p1', position: 0, total_score: 0, current_bid: 1, tricks_won_this_round: 1 },
    { id: 'p2', position: 1, total_score: 0, current_bid: 1, tricks_won_this_round: 1 },
    { id: 'p3', position: 2, total_score: 0, current_bid: 1, tricks_won_this_round: 1 },
  ];

  // Simulate end of round
  const result = handleRoundEnd(game, players, 'p1');

  assert(result.game.dealer_index === 1, 'Dealer rotates from 0 to 1');
  assert(result.game.current_round === 2, 'Round decrements to 2');
  assert(result.game.current_phase === 'round_end', 'Phase is round_end');
});

test('Dealer wraps around', () => {
  let game = { current_round: 2, dealer_index: 2, status: 'playing' };
  let players = [
    { id: 'p1', position: 0, total_score: 0, current_bid: 1, tricks_won_this_round: 1 },
    { id: 'p2', position: 1, total_score: 0, current_bid: 0, tricks_won_this_round: 0 },
    { id: 'p3', position: 2, total_score: 0, current_bid: 1, tricks_won_this_round: 1 },
  ];

  const result = handleRoundEnd(game, players, 'p1');

  assert(result.game.dealer_index === 0, 'Dealer wraps from 2 to 0');
});

test('Game ends after round 1', () => {
  let game = { current_round: 1, dealer_index: 0, status: 'playing' };
  let players = [
    { id: 'p1', position: 0, total_score: 20, current_bid: 1, tricks_won_this_round: 1 },
    { id: 'p2', position: 1, total_score: 15, current_bid: 0, tricks_won_this_round: 0 },
  ];

  const result = handleRoundEnd(game, players, 'p1');

  assert(result.game.current_phase === 'game_end', 'Phase is game_end');
  assert(result.game.status === 'finished', 'Status is finished');
  assert(result.roundScores !== undefined, 'Round scores returned');
});

// ============================================================================
// STRESS TESTS
// ============================================================================

section('STRESS TESTS');

test('Many games with random play', () => {
  let gamesCompleted = 0;
  let errors = [];

  for (let gameNum = 0; gameNum < 10; gameNum++) {
    try {
      const numPlayers = 2 + Math.floor(Math.random() * 6); // 2-7 players
      const startingRound = Math.min(7, Math.floor(52 / numPlayers));

      let game = {
        id: `test-${gameNum}`,
        room_code: 'STRESS',
        status: 'playing',
        current_round: startingRound,
        dealer_index: 0
      };

      let players = [];
      for (let i = 0; i < numPlayers; i++) {
        players.push({ id: `p${i}`, name: `Player${i}`, position: i, total_score: 0 });
      }

      let rounds = 0;
      while (game.current_phase !== 'game_end' && rounds < 20) {
        // Start round
        const roundResult = startRound(game, players);
        game = roundResult.game;
        players = roundResult.players;

        // Random bidding
        for (let i = 0; i < numPlayers; i++) {
          const bidderIndex = (game.dealer_index + i) % numPlayers;
          const bidder = players[bidderIndex];
          const bidsSoFar = players.filter(p => p.current_bid !== null).map(p => p.current_bid);
          const isLast = i === numPlayers - 1;
          const validBids = getValidBids(game.current_round, bidsSoFar, isLast);
          const bid = validBids[Math.floor(Math.random() * validBids.length)];

          const bidResult = processBid(game, players, bidder.id, bid);
          if (bidResult.error) throw new Error(`Bid error: ${bidResult.error}`);
          game = bidResult.game;
          players = bidResult.players;
        }

        // Play all tricks
        const tricksThisRound = game.current_round;
        for (let trick = 0; trick < tricksThisRound; trick++) {
          for (let play = 0; play < numPlayers; play++) {
            const currentPlayer = players[game.current_player_index];
            const leadSuit = game.current_trick.length > 0 ? game.current_trick[0].card.suit : null;
            const validCards = getValidCards(currentPlayer.hand, leadSuit);
            const card = validCards[Math.floor(Math.random() * validCards.length)];

            const playResult = processCardPlay(game, players, currentPlayer.id, card);
            if (playResult.error) throw new Error(`Play error: ${playResult.error}`);
            game = playResult.game;
            players = playResult.players;
          }
        }

        rounds++;
      }

      gamesCompleted++;
    } catch (e) {
      errors.push(`Game ${gameNum}: ${e.message}`);
    }
  }

  assert(gamesCompleted === 10, `Completed ${gamesCompleted}/10 random games`);
  if (errors.length > 0) {
    console.log('    Errors:', errors);
  }
});

test('Maximum players (7) full game', () => {
  let game = {
    id: 'max-players',
    room_code: 'MAXPLY',
    status: 'playing',
    current_round: 7, // Max for 7 players (52/7 = 7)
    dealer_index: 0
  };

  let players = [];
  for (let i = 0; i < 7; i++) {
    players.push({ id: `p${i}`, name: `Player${i}`, position: i, total_score: 0 });
  }

  let rounds = 0;
  let errors = [];

  while (game.current_phase !== 'game_end' && rounds < 10) {
    try {
      const roundResult = startRound(game, players);
      game = roundResult.game;
      players = roundResult.players;

      // Bidding
      for (let i = 0; i < 7; i++) {
        const bidderIndex = (game.dealer_index + i) % 7;
        const bidder = players[bidderIndex];
        const bidsSoFar = players.filter(p => p.current_bid !== null).map(p => p.current_bid);
        const isLast = i === 6;
        const validBids = getValidBids(game.current_round, bidsSoFar, isLast);
        const bid = validBids[0];

        const bidResult = processBid(game, players, bidder.id, bid);
        if (bidResult.error) throw new Error(bidResult.error);
        game = bidResult.game;
        players = bidResult.players;
      }

      // Play tricks
      for (let trick = 0; trick < game.current_round; trick++) {
        for (let play = 0; play < 7; play++) {
          const currentPlayer = players[game.current_player_index];
          const leadSuit = game.current_trick.length > 0 ? game.current_trick[0].card.suit : null;
          const validCards = getValidCards(currentPlayer.hand, leadSuit);

          const playResult = processCardPlay(game, players, currentPlayer.id, validCards[0]);
          if (playResult.error) throw new Error(playResult.error);
          game = playResult.game;
          players = playResult.players;
        }
      }

      rounds++;
    } catch (e) {
      errors.push(e.message);
      break;
    }
  }

  assert(errors.length === 0, `7-player game completed without errors`);
  assert(game.current_phase === 'game_end', 'Game ended properly');
});

test('Minimum players (2) full game from round 7', () => {
  let game = {
    id: 'min-players',
    room_code: 'MINPLY',
    status: 'playing',
    current_round: 7,
    dealer_index: 0
  };

  let players = [
    { id: 'p1', name: 'Alice', position: 0, total_score: 0 },
    { id: 'p2', name: 'Bob', position: 1, total_score: 0 },
  ];

  let rounds = 0;

  while (game.current_phase !== 'game_end' && rounds < 10) {
    const roundResult = startRound(game, players);
    game = roundResult.game;
    players = roundResult.players;

    // Bidding
    for (let i = 0; i < 2; i++) {
      const bidder = players[game.current_player_index];
      const bidsSoFar = players.filter(p => p.current_bid !== null).map(p => p.current_bid);
      const isLast = i === 1;
      const validBids = getValidBids(game.current_round, bidsSoFar, isLast);

      const bidResult = processBid(game, players, bidder.id, validBids[0]);
      game = bidResult.game;
      players = bidResult.players;
    }

    // Play tricks
    for (let trick = 0; trick < game.current_round; trick++) {
      for (let play = 0; play < 2; play++) {
        const currentPlayer = players[game.current_player_index];
        const leadSuit = game.current_trick.length > 0 ? game.current_trick[0].card.suit : null;
        const validCards = getValidCards(currentPlayer.hand, leadSuit);

        const playResult = processCardPlay(game, players, currentPlayer.id, validCards[0]);
        game = playResult.game;
        players = playResult.players;
      }
    }

    rounds++;
  }

  assert(rounds === 7, '2-player game plays 7 rounds (7 to 1)');
  assert(game.current_phase === 'game_end', 'Game ended properly');
  // Minimum total = sum of all tricks (7+6+5+4+3+2+1 = 28) - this is if nobody gets bonus
  assert(players[0].total_score + players[1].total_score >= 28, 'Minimum possible total score achieved');
});

// ============================================================================
// RESULTS
// ============================================================================

console.log(`\n${'='.repeat(60)}`);
console.log(`  FINAL RESULTS`);
console.log('='.repeat(60));
console.log(`  Total: ${totalTests} tests`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Pass Rate: ${((passed/totalTests)*100).toFixed(1)}%`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
