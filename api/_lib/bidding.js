/**
 * Bidding logic for Contract Whist
 *
 * Rule: The last bidder cannot bid a number such that
 * (sum of all bids) === current_round (total bids cannot equal tricks available)
 */

/**
 * Get the list of invalid bids for the last bidder
 * @param {number[]} bidsSoFar - Bids already made this round
 * @param {number} currentRound - Current round number (7 down to 1)
 * @returns {number[]} - List of bid values that are invalid
 */
function getInvalidBidsForLastBidder(bidsSoFar, currentRound) {
  const sumSoFar = bidsSoFar.reduce((a, b) => a + b, 0);
  const invalidBids = [];

  // Check all possible bids 0 to currentRound
  // The invalid bid is the one that makes total === currentRound
  for (let bid = 0; bid <= currentRound; bid++) {
    if (sumSoFar + bid === currentRound) {
      invalidBids.push(bid);
    }
  }

  return invalidBids;
}

/**
 * Validate a bid
 * @param {number} bid - The bid value
 * @param {number} currentRound - Current round number
 * @param {number[]} bidsSoFar - Bids already made
 * @param {boolean} isLastBidder - Whether this is the last player to bid
 * @returns {{ valid: boolean, error?: string }}
 */
function validateBid(bid, currentRound, bidsSoFar, isLastBidder) {
  // Basic validation
  if (typeof bid !== 'number' || !Number.isInteger(bid)) {
    return { valid: false, error: 'Bid must be an integer' };
  }

  if (bid < 0) {
    return { valid: false, error: 'Bid cannot be negative' };
  }

  if (bid > currentRound) {
    return { valid: false, error: `Bid cannot exceed ${currentRound} (cards in hand)` };
  }

  // Last bidder restriction
  if (isLastBidder) {
    const invalidBids = getInvalidBidsForLastBidder(bidsSoFar, currentRound);
    if (invalidBids.includes(bid)) {
      return {
        valid: false,
        error: `Cannot bid ${bid} - would make total bids divisible by ${currentRound}`
      };
    }
  }

  return { valid: true };
}

/**
 * Get all valid bids for a player
 * @param {number} currentRound - Current round number
 * @param {number[]} bidsSoFar - Bids already made
 * @param {boolean} isLastBidder - Whether this is the last player to bid
 * @returns {number[]} - List of valid bid values
 */
function getValidBids(currentRound, bidsSoFar, isLastBidder) {
  const allBids = [];
  for (let i = 0; i <= currentRound; i++) {
    allBids.push(i);
  }

  if (!isLastBidder) {
    return allBids;
  }

  const invalidBids = getInvalidBidsForLastBidder(bidsSoFar, currentRound);
  return allBids.filter(bid => !invalidBids.includes(bid));
}

/**
 * Check if bidding is complete
 * @param {(number|null)[]} bids - Array of bids (null if not yet bid)
 * @returns {boolean}
 */
function isBiddingComplete(bids) {
  return bids.every(bid => bid !== null && bid !== undefined);
}

/**
 * Get the next bidder index
 * @param {number} dealerIndex - Index of the dealer
 * @param {(number|null)[]} bids - Current bids array
 * @param {number} numPlayers - Total number of players
 * @returns {number|null} - Next bidder index, or null if complete
 */
function getNextBidderIndex(dealerIndex, bids, numPlayers) {
  // Bidding starts from dealer and goes clockwise
  for (let i = 0; i < numPlayers; i++) {
    const playerIndex = (dealerIndex + i) % numPlayers;
    if (bids[playerIndex] === null || bids[playerIndex] === undefined) {
      return playerIndex;
    }
  }
  return null;
}

module.exports = {
  getInvalidBidsForLastBidder,
  validateBid,
  getValidBids,
  isBiddingComplete,
  getNextBidderIndex
};
