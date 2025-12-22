/**
 * Game Logic Tests
 * Run with: node tests/game-logic.test.js
 */

const { startRound, processBid, processCardPlay, getPlayerGameState } = require('../api/_lib/game-logic');
const { dealCards, createDeck, sortHand } = require('../api/_lib/deck');
const { validateBid, isBiddingComplete, getValidBids } = require('../api/_lib/bidding');
const { resolveTrick, validateCardPlay, getValidCards } = require('../api/_lib/tricks');
const { calculateRoundScores } = require('../api/_lib/scoring');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

function test(name, fn) {
  console.log(`\n${name}`);
  try {
    fn();
  } catch (e) {
    failed++;
    console.log(`  ✗ Error: ${e.message}`);
  }
}

// ==== DECK TESTS ====

test('Deck: creates 52 cards', () => {
  const deck = createDeck();
  assert(deck.length === 52, 'Deck has 52 cards');

  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  suits.forEach(suit => {
    const suitCards = deck.filter(c => c.suit === suit);
    assert(suitCards.length === 13, `${suit} has 13 cards`);
  });
});

test('Deck: deals correct number of cards', () => {
  const { hands, remainingDeck } = dealCards(4, 7);
  assert(hands.length === 4, 'Creates 4 hands');
  assert(hands.every(h => h.length === 7), 'Each hand has 7 cards');
  assert(remainingDeck.length === 52 - 28, 'Remaining deck has correct count');
});

// ==== BIDDING TESTS ====

test('Bidding: validates bid range', () => {
  const result1 = validateBid(0, 7, [], false);
  assert(result1.valid === true, 'Bid 0 is valid');

  const result2 = validateBid(7, 7, [], false);
  assert(result2.valid === true, 'Bid 7 is valid in round 7');

  const result3 = validateBid(8, 7, [], false);
  assert(result3.valid === false, 'Bid 8 is invalid in round 7');

  const result4 = validateBid(-1, 7, [], false);
  assert(result4.valid === false, 'Negative bid is invalid');
});

test('Bidding: last bidder restriction', () => {
  // Rule: Total bids cannot equal the round number
  // In round 7, if total bids so far = 6, last bidder cannot bid 1 (would make total = 7)
  const bidsSoFar = [1, 2, 2, 1]; // sum = 6
  const validBids = getValidBids(7, bidsSoFar, true);

  assert(!validBids.includes(1), 'Last bidder cannot make total equal round number');
  assert(validBids.includes(0), 'Last bidder can bid 0');
  assert(validBids.includes(2), 'Last bidder can bid 2');
});

test('Bidding: isBiddingComplete', () => {
  assert(!isBiddingComplete([1, 2, null]), 'Incomplete when null exists');
  assert(isBiddingComplete([1, 2, 3]), 'Complete when all bids made');
});

// ==== TRICK TESTS ====

test('Tricks: validate card play - must follow suit', () => {
  // Using numeric ranks: 2-10, 11=J, 12=Q, 13=K, 14=A
  const hand = [
    { suit: 'hearts', rank: 14 },  // Ace
    { suit: 'hearts', rank: 13 },  // King
    { suit: 'spades', rank: 2 }
  ];

  const leadSuit = 'hearts';
  const validCards = getValidCards(hand, leadSuit);

  assert(validCards.length === 2, 'Can only play 2 hearts');
  assert(validCards.every(c => c.suit === 'hearts'), 'All valid cards are hearts');

  // Can play any card if can't follow suit
  const validCards2 = getValidCards(hand, 'diamonds');
  assert(validCards2.length === 3, 'Can play any card if no diamonds');
});

test('Tricks: resolve trick - lead suit wins', () => {
  // Using numeric ranks: 2-10, 11=J, 12=Q, 13=K, 14=A
  const trick = [
    { playerId: 'p1', card: { suit: 'hearts', rank: 2 } },
    { playerId: 'p2', card: { suit: 'hearts', rank: 14 } },  // Ace
    { playerId: 'p3', card: { suit: 'hearts', rank: 13 } }   // King
  ];

  const winnerId = resolveTrick(trick, 'spades');
  assert(winnerId === 'p2', 'Highest lead suit card wins');
});

test('Tricks: resolve trick - trump wins', () => {
  const trick = [
    { playerId: 'p1', card: { suit: 'hearts', rank: 14 } },  // Ace
    { playerId: 'p2', card: { suit: 'spades', rank: 2 } },   // trump (low)
    { playerId: 'p3', card: { suit: 'hearts', rank: 13 } }   // King
  ];

  const winnerId = resolveTrick(trick, 'spades');
  assert(winnerId === 'p2', 'Trump card wins even with low rank');
});

test('Tricks: resolve trick - highest trump wins', () => {
  const trick = [
    { playerId: 'p1', card: { suit: 'spades', rank: 2 } },
    { playerId: 'p2', card: { suit: 'spades', rank: 14 } },  // Ace
    { playerId: 'p3', card: { suit: 'spades', rank: 13 } }   // King
  ];

  const winnerId = resolveTrick(trick, 'spades');
  assert(winnerId === 'p2', 'Highest trump wins');
});

// ==== SCORING TESTS ====

test('Scoring: calculate round scores', () => {
  const scoreData = [
    { id: 'p1', tricksWon: 3, bid: 3, totalScore: 0 },  // Made contract
    { id: 'p2', tricksWon: 2, bid: 4, totalScore: 0 },  // Missed
    { id: 'p3', tricksWon: 2, bid: 2, totalScore: 10 }  // Made contract
  ];

  const scores = calculateRoundScores(scoreData);

  const p1Score = scores.find(s => s.id === 'p1');
  const p2Score = scores.find(s => s.id === 'p2');
  const p3Score = scores.find(s => s.id === 'p3');

  assert(p1Score.madeContract === true, 'P1 made contract');
  assert(p1Score.roundPoints === 13, 'P1 gets 3 + 10 = 13 points');
  assert(p1Score.newTotalScore === 13, 'P1 new total is 13');

  assert(p2Score.madeContract === false, 'P2 missed contract');
  assert(p2Score.roundPoints === 2, 'P2 gets only 2 points');

  assert(p3Score.madeContract === true, 'P3 made contract');
  assert(p3Score.roundPoints === 12, 'P3 gets 2 + 10 = 12 points');
  assert(p3Score.newTotalScore === 22, 'P3 new total is 10 + 12 = 22');
});

// ==== GAME FLOW TESTS ====

test('Game Flow: startRound initializes correctly', () => {
  const game = {
    id: 'game1',
    room_code: 'ABCDEF',
    status: 'playing',
    current_round: 7,
    dealer_index: 0
  };

  const players = [
    { id: 'p1', name: 'Alice', position: 0, total_score: 0 },
    { id: 'p2', name: 'Bob', position: 1, total_score: 0 },
    { id: 'p3', name: 'Carol', position: 2, total_score: 0 }
  ];

  const result = startRound(game, players);

  assert(result.game.current_phase === 'bidding', 'Phase is bidding');
  assert(result.game.current_player_index === 0, 'Dealer bids first');
  assert(result.game.trump_card !== null, 'Trump card is set');
  assert(result.game.current_trick.length === 0, 'Trick is empty');
  assert(result.players.every(p => p.hand.length === 7), 'Each player has 7 cards');
  assert(result.players.every(p => p.current_bid === null), 'All bids are null');
  assert(result.players.every(p => p.tricks_won_this_round === 0), 'All tricks won are 0');
});

test('Game Flow: processBid advances correctly', () => {
  const game = {
    current_phase: 'bidding',
    current_round: 3,
    current_player_index: 0,
    dealer_index: 0
  };

  const players = [
    { id: 'p1', name: 'Alice', position: 0, current_bid: null },
    { id: 'p2', name: 'Bob', position: 1, current_bid: null },
    { id: 'p3', name: 'Carol', position: 2, current_bid: null }
  ];

  // First bid
  const result1 = processBid(game, players, 'p1', 1);
  assert(!result1.error, 'First bid succeeds');
  assert(result1.players[0].current_bid === 1, 'P1 bid is recorded');
  assert(result1.game.current_phase === 'bidding', 'Still in bidding phase');

  // Second bid
  const result2 = processBid(result1.game, result1.players, 'p2', 1);
  assert(!result2.error, 'Second bid succeeds');

  // Third (last) bid - P3 is last bidder with sum=2 so far
  // In round 3, bid that makes total % 3 === 0 is invalid
  // Sum so far = 2, so bid 1 would make total 3 (invalid), bid 0 or 2 would be valid
  const result3 = processBid(result2.game, result2.players, 'p3', 2);
  assert(!result3.error, 'Third bid succeeds');
  assert(result3.game.current_phase === 'playing', 'Phase changes to playing');
  assert(result3.game.trick_number === 1, 'Trick number is 1');
});

test('Game Flow: processCardPlay completes trick', () => {
  // Using numeric ranks: 2-10, 11=J, 12=Q, 13=K, 14=A
  const game = {
    current_phase: 'playing',
    current_round: 3,
    current_trick: [],
    trick_number: 1,
    dealer_index: 0,
    current_player_index: 0,
    lead_player_index: 0,
    trump_suit: 'spades'
  };

  const players = [
    { id: 'p1', name: 'Alice', position: 0, hand: [{ suit: 'hearts', rank: 14 }, { suit: 'hearts', rank: 13 }, { suit: 'hearts', rank: 12 }], tricks_won_this_round: 0, current_bid: 1, total_score: 0 },
    { id: 'p2', name: 'Bob', position: 1, hand: [{ suit: 'hearts', rank: 2 }, { suit: 'clubs', rank: 13 }, { suit: 'clubs', rank: 12 }], tricks_won_this_round: 0, current_bid: 1, total_score: 0 },
    { id: 'p3', name: 'Carol', position: 2, hand: [{ suit: 'hearts', rank: 3 }, { suit: 'diamonds', rank: 13 }, { suit: 'diamonds', rank: 12 }], tricks_won_this_round: 0, current_bid: 1, total_score: 0 }
  ];

  // P1 plays
  const result1 = processCardPlay(game, players, 'p1', { suit: 'hearts', rank: 14 });
  assert(!result1.error, 'P1 plays successfully');
  assert(result1.game.current_trick.length === 1, 'Trick has 1 card');

  // P2 plays
  const result2 = processCardPlay(result1.game, result1.players, 'p2', { suit: 'hearts', rank: 2 });
  assert(!result2.error, 'P2 plays successfully');

  // P3 plays
  const result3 = processCardPlay(result2.game, result2.players, 'p3', { suit: 'hearts', rank: 3 });
  assert(!result3.error, 'P3 plays successfully');
  assert(result3.trickWinner === 'p1', 'P1 wins with Ace of hearts');
  assert(result3.game.current_trick.length === 0, 'Trick is cleared');
  assert(result3.game.trick_number === 2, 'Trick number advances');

  const p1 = result3.players.find(p => p.id === 'p1');
  assert(p1.tricks_won_this_round === 1, 'P1 has 1 trick won');
});

test('Game Flow: round ends after all tricks', () => {
  // Simulate a 1-card round (quick to test)
  // Using numeric ranks: 14=A, 2=2
  const game = {
    current_phase: 'playing',
    current_round: 1,
    current_trick: [],
    trick_number: 1,
    dealer_index: 0,
    current_player_index: 0,
    lead_player_index: 0,
    trump_suit: 'spades'
  };

  const players = [
    { id: 'p1', name: 'Alice', position: 0, hand: [{ suit: 'hearts', rank: 14 }], tricks_won_this_round: 0, current_bid: 1, total_score: 0 },
    { id: 'p2', name: 'Bob', position: 1, hand: [{ suit: 'hearts', rank: 2 }], tricks_won_this_round: 0, current_bid: 0, total_score: 0 }
  ];

  // P1 plays
  const result1 = processCardPlay(game, players, 'p1', { suit: 'hearts', rank: 14 });

  // P2 plays - this should end the round
  const result2 = processCardPlay(result1.game, result1.players, 'p2', { suit: 'hearts', rank: 2 });

  assert(result2.roundScores !== undefined, 'Round scores are returned');
  assert(result2.game.current_phase === 'game_end', 'Game ends after round 1');
  assert(result2.game.status === 'finished', 'Game status is finished');

  // Check scores
  const p1Score = result2.roundScores.find(s => s.id === 'p1');
  const p2Score = result2.roundScores.find(s => s.id === 'p2');

  assert(p1Score.madeContract === true, 'P1 made contract (bid 1, won 1)');
  assert(p2Score.madeContract === true, 'P2 made contract (bid 0, won 0)');
});

test('Game Flow: getPlayerGameState hides other hands', () => {
  // Using numeric ranks: 13=K, 14=A
  const game = {
    room_code: 'ABCDEF',
    status: 'playing',
    current_round: 7,
    current_phase: 'playing',
    dealer_index: 0,
    current_player_index: 1,
    trump_suit: 'hearts',
    trump_card: { suit: 'hearts', rank: 13 },
    current_trick: [],
    trick_number: 1,
    lead_player_index: 1,
    round_scores: null
  };

  const players = [
    { id: 'p1', session_id: 's1', name: 'Alice', position: 0, hand: [{ suit: 'hearts', rank: 14 }], current_bid: 1, tricks_won_this_round: 0, total_score: 0, is_connected: true },
    { id: 'p2', session_id: 's2', name: 'Bob', position: 1, hand: [{ suit: 'spades', rank: 13 }], current_bid: 2, tricks_won_this_round: 1, total_score: 10, is_connected: true }
  ];

  const state = getPlayerGameState(game, players, 's1');

  assert(state.myHand.length === 1, 'Returns my hand');
  assert(state.myHand[0].suit === 'hearts', 'My hand is correct');
  assert(state.myId === 'p1', 'My ID is correct');

  // Other players should not have hands visible
  assert(state.players[0].card_count === 1, 'P1 card count is visible');
  assert(state.players[1].card_count === 1, 'P2 card count is visible');
  assert(state.players[0].hand === undefined, 'P1 hand is hidden from state');
  assert(state.players[1].hand === undefined, 'P2 hand is hidden from state');

  // Game state should include round_scores
  assert(state.game.round_scores === null, 'Round scores included in state');
});

// ==== RESULTS ====

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);

if (failed > 0) {
  process.exit(1);
}
