/**
 * Card representation:
 * { suit: 'hearts'|'diamonds'|'clubs'|'spades', rank: 2-14 }
 * rank: 2-10 = face value, 11=Jack, 12=Queen, 13=King, 14=Ace
 */

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/**
 * Create a standard 52-card deck
 */
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle algorithm
 */
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deal cards to players
 * @param {number} numPlayers - Number of players
 * @param {number} cardsPerPlayer - Cards to deal to each player
 * @returns {{ hands: Card[][], remainingDeck: Card[] }}
 */
function dealCards(numPlayers, cardsPerPlayer) {
  const deck = shuffleDeck(createDeck());
  const hands = [];

  for (let i = 0; i < numPlayers; i++) {
    hands.push([]);
  }

  // Deal cards one at a time to each player (like real dealing)
  for (let card = 0; card < cardsPerPlayer; card++) {
    for (let player = 0; player < numPlayers; player++) {
      hands[player].push(deck.shift());
    }
  }

  return {
    hands,
    remainingDeck: deck
  };
}

/**
 * Get the trump card (flip top card of remaining deck)
 */
function getTrumpCard(remainingDeck) {
  if (remainingDeck.length === 0) {
    return null;
  }
  return remainingDeck[0];
}

/**
 * Sort a hand by suit then rank
 */
function sortHand(hand) {
  const suitOrder = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
  return [...hand].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return b.rank - a.rank;
  });
}

/**
 * Check if two cards are equal
 */
function cardsEqual(card1, card2) {
  return card1.suit === card2.suit && card1.rank === card2.rank;
}

/**
 * Get display name for a card rank
 */
function getRankDisplay(rank) {
  if (rank <= 10) return rank.toString();
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  return rank.toString();
}

/**
 * Get card filename for SVG
 */
function getCardFilename(card) {
  const rankNames = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
    11: 'jack', 12: 'queen', 13: 'king', 14: 'ace'
  };
  return `${rankNames[card.rank]}_of_${card.suit}.svg`;
}

module.exports = {
  SUITS,
  RANKS,
  createDeck,
  shuffleDeck,
  dealCards,
  getTrumpCard,
  sortHand,
  cardsEqual,
  getRankDisplay,
  getCardFilename
};
