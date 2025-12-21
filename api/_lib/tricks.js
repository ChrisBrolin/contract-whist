/**
 * Trick resolution logic for Contract Whist
 */

const { cardsEqual } = require('./deck');

/**
 * Determine the winner of a trick
 * @param {Array<{playerId: string, card: {suit: string, rank: number}}>} trick - Cards played
 * @param {string} trumpSuit - The trump suit for this round
 * @returns {string} - The playerId of the winner
 */
function resolveTrick(trick, trumpSuit) {
  if (trick.length === 0) {
    throw new Error('Cannot resolve empty trick');
  }

  const leadSuit = trick[0].card.suit;
  let winner = trick[0];

  for (let i = 1; i < trick.length; i++) {
    const current = trick[i];
    const currentCard = current.card;
    const winningCard = winner.card;

    const currentIsTrump = currentCard.suit === trumpSuit;
    const winnerIsTrump = winningCard.suit === trumpSuit;

    if (currentIsTrump && !winnerIsTrump) {
      // Trump beats non-trump
      winner = current;
    } else if (currentIsTrump && winnerIsTrump) {
      // Both trump: higher rank wins
      if (currentCard.rank > winningCard.rank) {
        winner = current;
      }
    } else if (!currentIsTrump && !winnerIsTrump) {
      // Neither trump: must be lead suit to win, and higher rank
      if (currentCard.suit === leadSuit && currentCard.rank > winningCard.rank) {
        winner = current;
      }
    }
    // If current is not trump and winner is trump, winner stays
  }

  return winner.playerId;
}

/**
 * Check if a card play is valid
 * @param {Object} card - The card being played
 * @param {Object[]} hand - The player's hand
 * @param {string|null} leadSuit - The suit that was led (null if leading)
 * @returns {{ valid: boolean, error?: string }}
 */
function validateCardPlay(card, hand, leadSuit) {
  // Check if card is in hand
  const cardInHand = hand.some(c => cardsEqual(c, card));
  if (!cardInHand) {
    return { valid: false, error: 'Card not in hand' };
  }

  // If leading, any card is valid
  if (!leadSuit) {
    return { valid: true };
  }

  // Must follow suit if able
  const hasLeadSuit = hand.some(c => c.suit === leadSuit);
  if (hasLeadSuit && card.suit !== leadSuit) {
    return { valid: false, error: `Must follow suit (${leadSuit})` };
  }

  return { valid: true };
}

/**
 * Get valid cards that can be played
 * @param {Object[]} hand - The player's hand
 * @param {string|null} leadSuit - The suit that was led (null if leading)
 * @returns {Object[]} - Cards that can be legally played
 */
function getValidCards(hand, leadSuit) {
  if (!leadSuit) {
    // Leading - can play anything
    return [...hand];
  }

  // Must follow suit if able
  const suitCards = hand.filter(c => c.suit === leadSuit);
  if (suitCards.length > 0) {
    return suitCards;
  }

  // Can't follow suit - play anything
  return [...hand];
}

/**
 * Remove a card from hand
 * @param {Object[]} hand - The player's hand
 * @param {Object} card - The card to remove
 * @returns {Object[]} - New hand without the card
 */
function removeCardFromHand(hand, card) {
  const index = hand.findIndex(c => cardsEqual(c, card));
  if (index === -1) {
    return hand;
  }
  const newHand = [...hand];
  newHand.splice(index, 1);
  return newHand;
}

/**
 * Check if trick is complete
 * @param {Array} trick - Current trick
 * @param {number} numPlayers - Number of players
 * @returns {boolean}
 */
function isTrickComplete(trick, numPlayers) {
  return trick.length === numPlayers;
}

/**
 * Get the next player index for the trick
 * @param {number} leadPlayerIndex - Who led the trick
 * @param {number} cardsPlayed - How many cards played so far
 * @param {number} numPlayers - Total players
 * @returns {number}
 */
function getNextPlayerInTrick(leadPlayerIndex, cardsPlayed, numPlayers) {
  return (leadPlayerIndex + cardsPlayed) % numPlayers;
}

module.exports = {
  resolveTrick,
  validateCardPlay,
  getValidCards,
  removeCardFromHand,
  isTrickComplete,
  getNextPlayerInTrick
};
