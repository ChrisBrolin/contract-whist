# Contract Whist - AI Development Guide

> A real-time multiplayer Contract Whist card game. Mobile-first, Vanilla JS frontend, Vercel serverless backend, Supabase for persistence and realtime.

## Quick Start

```bash
npm install              # Install dependencies
npm run dev              # Start Vercel dev server (localhost:3000)
npm test                 # Run all tests
npm run test:basic       # Run basic game logic tests
npm run test:comprehensive  # Run comprehensive tests
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  public/js/app.js (entry) → state.js → ui.js → cards.js         │
│                    ↓                                             │
│              api.js ←→ realtime.js (Supabase subscriptions)     │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Vercel Serverless)                   │
│  api/games.js (single endpoint, action-based routing)           │
│       ↓                                                          │
│  api/_lib/game-logic.js (orchestrator)                          │
│       ↓                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ deck.js │ bidding.js │ tricks.js │ scoring.js │ etc.   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE                                      │
│  PostgreSQL: games, players tables                               │
│  Realtime: WebSocket subscriptions per room                      │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
contract-whist/
├── api/                      # Vercel serverless functions
│   ├── games.js              # API router (~80 lines)
│   └── _lib/                 # Shared server-side modules
│       ├── handlers/         # Action handlers (split by feature)
│       │   ├── room.js       # create, join, get, leave
│       │   ├── game.js       # start, bid, play, next-round
│       │   └── player.js     # remove-player, active
│       ├── game-logic.js     # State machine, game orchestration
│       ├── deck.js           # Shuffle, deal cards
│       ├── bidding.js        # Bid validation, last-bidder restriction
│       ├── tricks.js         # Trick resolution, valid play detection
│       ├── scoring.js        # Score calculation
│       ├── room-code.js      # Generate 6-char room codes
│       └── supabase.js       # Supabase admin client
├── public/                   # Static frontend files
│   ├── index.html            # SPA shell
│   ├── css/
│   │   ├── main.css          # Base styles, glassmorphism (752 lines)
│   │   ├── cards.css         # Card styling
│   │   └── animations.css    # CSS animations (no scale transforms)
│   ├── js/
│   │   ├── app.js            # Entry point, event handlers (368 lines)
│   │   ├── state.js          # Client game state (GameState object)
│   │   ├── ui.js             # Screen rendering (539 lines)
│   │   ├── cards.js          # Card HTML generation
│   │   ├── api.js            # HTTP API wrapper
│   │   ├── realtime.js       # Supabase realtime subscriptions
│   │   ├── supabase-client.js # Supabase browser client
│   │   └── config.js         # Configuration
│   └── assets/
│       ├── yosemite.jpg      # Background image
│       └── cards/            # SVG card images (52 + back)
├── tests/
│   ├── game-logic.test.js    # Basic unit tests
│   └── comprehensive.test.js # Full game simulation tests (227 tests)
├── .claude/
│   └── commands/             # Claude Code custom commands
│       ├── add-feature.md    # Workflow for adding features
│       ├── fix-bug.md        # Workflow for fixing bugs
│       ├── test.md           # Running tests
│       └── deploy.md         # Deployment instructions
├── PLAN.md                   # Original design document
└── CLAUDE.md                 # This file
```

## Conventions

### Naming
- **Variables/functions**: camelCase (`playerHand`, `submitBid`)
- **Files**: kebab-case (`game-logic.js`, `room-code.js`)
- **CSS classes**: kebab-case (`.player-hand`, `.card-back`)
- **Constants**: UPPER_SNAKE_CASE (`SUITS`, `RANKS`)

### Code Style
- Vanilla JS only (no frameworks, no build step)
- ES6+ features (async/await, arrow functions, destructuring)
- Module pattern with global objects on `window` for frontend
- CommonJS `require()`/`module.exports` for backend

### Cards
```javascript
// Card object structure
{ suit: 'hearts', rank: 14 }  // Ace of hearts
// rank: 2-10, 11=Jack, 12=Queen, 13=King, 14=Ace
// suit: 'hearts', 'diamonds', 'clubs', 'spades'
```

### API Pattern
Single endpoint at `/api/games` with action-based routing:
```javascript
POST /api/games { action: 'create', playerName: 'Alice' }
POST /api/games { action: 'join', roomCode: 'ABC123', playerName: 'Bob' }
POST /api/games { action: 'start', roomCode: 'ABC123' }
POST /api/games { action: 'bid', roomCode: 'ABC123', bid: 2 }
POST /api/games { action: 'play', roomCode: 'ABC123', card: {suit, rank} }
GET  /api/games?roomCode=ABC123  # Get game state
```

## Game Flow State Machine

```
LOBBY → BIDDING → PLAYING → ROUND_END → (repeat) → GAME_END
          ↑___________________________|
```

- **LOBBY**: Players join, host starts game (2-7 players)
- **BIDDING**: Deal cards, flip trump, players bid in order
- **PLAYING**: Play tricks, must follow suit if able
- **ROUND_END**: Calculate scores (+1/trick, +10 bonus if bid=tricks)
- **GAME_END**: Display winner

## Key Algorithms

### Last Bidder Restriction (bidding.js:50-70)
Last bidder cannot make total bids divisible by round number:
```javascript
if ((sumOfBids + bid) % currentRound === 0) invalid
```

### Trick Resolution (tricks.js:80-120)
1. Trump beats non-trump
2. Among trumps, higher rank wins
3. Among non-trumps, must match lead suit to win
4. Higher rank of lead suit wins

### Valid Card Detection (tricks.js:30-50)
- If you have lead suit, must play it
- If not, can play any card (including trump)

## Hotspots (Code that often breaks)

1. **api/games.js handleStart** - Round initialization, dealing cards
2. **api/_lib/game-logic.js advanceToNextRound** - State transitions
3. **public/js/ui.js updateGame** - Complex UI rendering
4. **api/_lib/bidding.js isValidBid** - Last bidder restriction edge cases

## Database Schema

```sql
-- games table
id, room_code, status, current_round, current_phase, dealer_index,
current_player_index, trump_suit, trump_card, current_trick, tricks_won,
round_scores, created_at, updated_at

-- players table
id, game_id, name, session_id, position, hand, current_bid,
tricks_won_this_round, total_score, is_connected, last_seen
```

## Environment Variables

```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx...  # Backend only
SUPABASE_ANON_KEY=eyJxxx...     # Frontend (public)
```

## Common Tasks

### Add new game action
1. Add handler in `api/games.js` (e.g., `handleNewAction`)
2. Add case in switch statement
3. Add validation logic
4. Update game state in Supabase
5. Add API method in `public/js/api.js`
6. Connect UI in `public/js/app.js`

### Modify game rules
1. Update logic in `api/_lib/` (bidding, tricks, scoring, game-logic)
2. Add tests in `tests/comprehensive.test.js`
3. Run `npm test` to verify

### Update UI
1. Modify `public/js/ui.js` for rendering
2. Modify `public/css/main.css` for styling
3. Animations in `public/css/animations.css` (avoid scale transforms)

## Testing

```bash
npm test  # Runs 227+ tests covering:
# - Deck creation and shuffling
# - Dealing cards
# - Bid validation (including last bidder restriction)
# - Trick resolution (all trump scenarios)
# - Score calculation
# - Full game simulations
```

## Known Issues / Technical Debt

1. `api/games.js` is 560 lines - could be split by action
2. `public/js/ui.js` is 539 lines - could be split by screen
3. No TypeScript (intentional - vanilla JS for simplicity)
4. Supabase free tier may have cold start delays

## Do NOT

- Add scale/pulse animations (user preference)
- Add emoji to host badge or code (user preference)
- Use frameworks or build tools
- Store secrets in frontend code
- Create new files without necessity

## Session ID Flow

1. User visits → generate UUID → store in localStorage
2. On API calls, send via `x-session-id` header
3. Used for reconnection detection, not authentication
