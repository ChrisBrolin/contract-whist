/**
 * Games API - Main Entry Point
 *
 * Single consolidated endpoint for all game actions.
 * Routes requests to appropriate handler modules.
 *
 * Actions:
 *   Room:   create, join, get, leave
 *   Game:   start, bid, play, next-round
 *   Player: remove-player, active
 */

const { handleCreate, handleJoin, handleGet, handleLeave } = require('./_lib/handlers/room');
const { handleStart, handleBid, handlePlay, handleNextRound } = require('./_lib/handlers/game');
const { handleRemovePlayer, handleActiveGame } = require('./_lib/handlers/player');

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-ID');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract common parameters
  const sessionId = req.headers['x-session-id'];
  const params = { ...req.query, ...req.body };
  const { action, roomCode, playerName, playerId, bid, card, startingRound } = params;

  try {
    let result;

    switch (action) {
      // Room management
      case 'create':
        result = await handleCreate(playerName, sessionId);
        break;
      case 'join':
        result = await handleJoin(roomCode, playerName, sessionId);
        break;
      case 'get':
        result = await handleGet(roomCode, sessionId);
        break;
      case 'leave':
        result = await handleLeave(roomCode, sessionId);
        break;

      // Game actions
      case 'start':
        result = await handleStart(roomCode, sessionId, startingRound);
        break;
      case 'bid':
        result = await handleBid(roomCode, bid, sessionId);
        break;
      case 'play':
        result = await handlePlay(roomCode, card, sessionId);
        break;
      case 'next-round':
        result = await handleNextRound(roomCode, sessionId);
        break;

      // Player management
      case 'remove-player':
        result = await handleRemovePlayer(roomCode, playerId, sessionId);
        break;
      case 'active':
        result = await handleActiveGame(sessionId);
        break;

      default:
        result = { status: 400, body: { error: 'Invalid action' } };
    }

    return res.status(result.status).json(result.body);

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
