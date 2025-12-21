/**
 * Scoring logic for Contract Whist
 *
 * Scoring: 1 point per trick won, +10 bonus if you hit your exact bid
 */

/**
 * Calculate round score for a player
 * @param {number} tricksWon - Number of tricks won
 * @param {number} bid - The player's bid
 * @returns {{ points: number, madeContract: boolean }}
 */
function calculateRoundScore(tricksWon, bid) {
  const madeContract = tricksWon === bid;
  const points = tricksWon + (madeContract ? 10 : 0);

  return {
    points,
    madeContract
  };
}

/**
 * Calculate scores for all players at end of round
 * @param {Array<{id: string, tricksWon: number, bid: number, totalScore: number}>} players
 * @returns {Array<{id: string, roundPoints: number, madeContract: boolean, newTotalScore: number}>}
 */
function calculateRoundScores(players) {
  return players.map(player => {
    const { points, madeContract } = calculateRoundScore(player.tricksWon, player.bid);
    return {
      id: player.id,
      roundPoints: points,
      madeContract,
      newTotalScore: player.totalScore + points
    };
  });
}

/**
 * Determine the winner(s) of the game
 * @param {Array<{id: string, name: string, totalScore: number}>} players
 * @returns {Array<{id: string, name: string, totalScore: number}>}
 */
function determineWinners(players) {
  if (players.length === 0) return [];

  const maxScore = Math.max(...players.map(p => p.totalScore));
  return players.filter(p => p.totalScore === maxScore);
}

/**
 * Get player rankings
 * @param {Array<{id: string, name: string, totalScore: number}>} players
 * @returns {Array<{id: string, name: string, totalScore: number, rank: number}>}
 */
function getPlayerRankings(players) {
  const sorted = [...players].sort((a, b) => b.totalScore - a.totalScore);

  let rank = 1;
  let prevScore = null;
  let skipCount = 0;

  return sorted.map((player, index) => {
    if (prevScore !== null && player.totalScore < prevScore) {
      rank += skipCount + 1;
      skipCount = 0;
    } else if (prevScore !== null && player.totalScore === prevScore) {
      skipCount++;
    }

    prevScore = player.totalScore;
    return { ...player, rank };
  });
}

/**
 * Calculate maximum possible score for a game
 * (useful for displaying progress)
 * @param {number} numRounds - Number of rounds (7 for standard game)
 * @returns {number}
 */
function calculateMaxPossibleScore(numRounds = 7) {
  // For each round, max is round_number (tricks) + 10 (bonus)
  // Rounds: 7, 6, 5, 4, 3, 2, 1 = 28 tricks total
  // + 10 bonus each round = 70 bonus
  // Total max = 98
  let total = 0;
  for (let round = 1; round <= numRounds; round++) {
    total += round + 10;
  }
  return total;
}

module.exports = {
  calculateRoundScore,
  calculateRoundScores,
  determineWinners,
  getPlayerRankings,
  calculateMaxPossibleScore
};
