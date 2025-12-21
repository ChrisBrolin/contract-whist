# Contract Whist - Complete Implementation Plan

## Overview
A real-time multiplayer Contract Whist card game, mobile-first, using Supabase for persistence and real-time communication.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Vanilla JS + CSS | Lightweight, fast on mobile, no build step needed |
| Backend | Node.js + Express | Serves static files, handles game logic |
| Real-time | Supabase Realtime | Built-in WebSocket pub/sub, no separate Socket.io server needed |
| Database | Supabase (PostgreSQL) | Persistence, handles reconnection, room state |
| Hosting | Vercel | Serverless functions, excellent for static + API |

### Why Supabase over Socket.io?
- **Persistence built-in**: Game state survives server restarts
- **Reconnection**: Players can rejoin games after disconnect
- **Realtime subscriptions**: Supabase Realtime channels replace Socket.io
- **Less infrastructure**: No need to manage WebSocket server scaling

---

## Database Schema (Supabase/PostgreSQL)

### Tables

```sql
-- Rooms/Games
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(6) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'lobby', -- 'lobby', 'playing', 'finished'
  current_round INTEGER DEFAULT 7,
  current_phase VARCHAR(20) DEFAULT 'waiting', -- 'waiting', 'bidding', 'playing', 'round_end', 'game_end'
  dealer_index INTEGER DEFAULT 0,
  current_player_index INTEGER,
  trump_suit VARCHAR(10), -- 'hearts', 'diamonds', 'clubs', 'spades'
  trump_card JSONB, -- {suit, rank} of the flipped card
  deck JSONB, -- remaining cards in deck (for trump flip)
  current_trick JSONB DEFAULT '[]', -- [{player_id, card: {suit, rank}}]
  trick_number INTEGER DEFAULT 0,
  tricks_won JSONB DEFAULT '{}', -- {player_id: count}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players in games
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  session_id VARCHAR(100) NOT NULL, -- for reconnection
  position INTEGER NOT NULL, -- 0-6, determines play order
  hand JSONB DEFAULT '[]', -- [{suit, rank}]
  current_bid INTEGER, -- null if hasn't bid yet
  tricks_won_this_round INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  is_connected BOOLEAN DEFAULT TRUE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_games_room_code ON games(room_code);
CREATE INDEX idx_players_game_id ON players(game_id);
CREATE INDEX idx_players_session_id ON players(session_id);
```

### Row Level Security (RLS)
- Players can only read their own hand
- Game state (except hands) is readable by all players in the game
- Updates go through server-side functions (service role key)

---

## Game Logic - Complete Specification

### Card Representation
```javascript
// Card: { suit: 'hearts'|'diamonds'|'clubs'|'spades', rank: 2-14 }
// rank: 2-10, 11=Jack, 12=Queen, 13=King, 14=Ace
```

### Game Flow State Machine

```
LOBBY → BIDDING → PLAYING → ROUND_END → (repeat until round 1 done) → GAME_END
           ↑__________________________|
```

### Phase: LOBBY
1. Creator creates room, gets room code (e.g., "ABC123")
2. Other players join via room code
3. Players see list of joined players
4. Creator can start game when 2-7 players have joined
5. **Validation**: 2-7 players required

### Phase: BIDDING (each round)
1. Deal cards: `current_round` cards to each player
2. Flip trump card from remaining deck
3. Players bid in order starting from dealer (dealer_index)
4. **Last bidder restriction**: Cannot bid N where (sum_of_bids + N) % current_round === 0
5. Once all bids submitted → transition to PLAYING

### Phase: PLAYING (each round)
1. Dealer leads first trick
2. Each player plays one card, must follow lead suit if able
3. After all players play:
   - Determine winner: highest trump wins, else highest of lead suit
   - Winner gets +1 tricks_won_this_round
   - Winner leads next trick
4. Repeat for `current_round` tricks
5. After all tricks → ROUND_END

### Phase: ROUND_END
1. Calculate scores:
   - Each player: +1 per trick won
   - +10 bonus if tricks_won === bid
2. Update total_score for each player
3. If current_round > 1:
   - Decrement current_round
   - Rotate dealer (dealer_index = (dealer_index + 1) % num_players)
   - Clear hands, bids, tricks
   - Go to BIDDING
4. If current_round === 1 and just finished → GAME_END

### Phase: GAME_END
1. Display final scores
2. Declare winner (highest score)
3. Option to play again (returns to LOBBY)

---

## Trick Resolution Algorithm

```javascript
function resolveTrick(trick, trumpSuit) {
  // trick = [{playerId, card: {suit, rank}}, ...]
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
      // Neither trump: must be lead suit to win
      if (currentCard.suit === leadSuit && currentCard.rank > winningCard.rank) {
        winner = current;
      }
    }
    // If current is not trump and winner is trump, winner stays
  }

  return winner.playerId;
}
```

---

## Bidding Restriction Algorithm

```javascript
function getInvalidBids(bids, currentRound, isLastBidder) {
  if (!isLastBidder) return [];

  const sumSoFar = bids.reduce((a, b) => a + b, 0);
  const invalidBids = [];

  // Check all possible bids 0 to currentRound
  for (let bid = 0; bid <= currentRound; bid++) {
    if ((sumSoFar + bid) % currentRound === 0) {
      invalidBids.push(bid);
    }
  }

  return invalidBids;
}

// Example: round 3, bids so far [1,1,0], last player can't bid 1
// sumSoFar = 2, invalid bids: (2+1)%3=0 → 1 is invalid
```

---

## Connection/Disconnection Handling

### Session Management
1. On first visit, generate `sessionId` (UUID), store in localStorage
2. `sessionId` is used to identify player across reconnects
3. Player record stores `session_id` for matching

### Connection Flow
```
1. Player opens app
2. Check localStorage for sessionId
3. If exists, check Supabase for active game with this session_id
4. If found and game not finished → rejoin game
5. If not found → show join/create screen
```

### Disconnect Detection
- Supabase Realtime presence tracks connected users
- On disconnect, set `is_connected = false`, update `last_seen`
- Game continues if player disconnects (they just miss their turn after timeout)

### Reconnection Flow
```
1. Player reconnects (same sessionId)
2. Set is_connected = true
3. Fetch current game state
4. Resume from current position
5. If it's their turn, they can now act
```

### Turn Timeout Handling
- If current player is disconnected for >30 seconds during their turn:
  - **During bidding**: Auto-bid 0
  - **During playing**: Auto-play first valid card
- This prevents game from stalling

### Abandoned Game Cleanup
- Games with all players disconnected for >10 minutes → mark as abandoned
- Cron job or Supabase function cleans up old games

---

## Real-time Communication (Supabase Realtime)

### Channel Structure
```
game:{room_code}  -- Main game channel for all players
```

### Events (Broadcast)
| Event | Payload | When |
|-------|---------|------|
| player_joined | {player} | New player joins lobby |
| player_left | {playerId} | Player leaves/disconnects |
| game_started | {gameState} | Creator starts game |
| new_round | {round, trump, dealer} | Round begins |
| bid_made | {playerId, bid} | Player submits bid |
| bidding_complete | {bids} | All bids in |
| card_played | {playerId, card} | Card played |
| trick_complete | {winnerId, trick} | Trick resolved |
| round_complete | {scores} | Round ends |
| game_complete | {finalScores, winner} | Game ends |

### Subscriptions
Each client subscribes to `game:{room_code}` on join and listens for all events.

### Presence
Use Supabase Presence to track who's online:
```javascript
channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState();
  // Update UI with who's connected
});
```

---

## API Endpoints (Node.js/Express)

### Room Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/games | Create new game, returns room_code |
| GET | /api/games/:roomCode | Get game state (filtered by player) |
| POST | /api/games/:roomCode/join | Join game |
| POST | /api/games/:roomCode/start | Start game (creator only) |
| POST | /api/games/:roomCode/leave | Leave game |

### Game Actions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/games/:roomCode/bid | Submit bid |
| POST | /api/games/:roomCode/play | Play a card |

### Reconnection
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/session/:sessionId/active-game | Check for active game |

---

## Project File Structure (Vercel-Compatible)

```
contract-whist/
├── package.json
├── vercel.json              # Vercel configuration
├── .env.local               # Local Supabase credentials (gitignored)
├── api/                     # Vercel serverless functions
│   ├── games/
│   │   ├── create.js        # POST /api/games/create
│   │   ├── [roomCode].js    # GET /api/games/:roomCode
│   │   ├── join.js          # POST /api/games/join
│   │   ├── start.js         # POST /api/games/start
│   │   └── leave.js         # POST /api/games/leave
│   ├── actions/
│   │   ├── bid.js           # POST /api/actions/bid
│   │   └── play.js          # POST /api/actions/play
│   ├── session/
│   │   └── active-game.js   # GET /api/session/active-game
│   └── _lib/                # Shared server code (not exposed as routes)
│       ├── supabase.js      # Supabase admin client
│       ├── game-logic.js    # Core game state machine
│       ├── deck.js          # Deck creation, shuffle, deal
│       ├── tricks.js        # Trick resolution
│       ├── bidding.js       # Bid validation
│       ├── scoring.js       # Score calculation
│       └── room-code.js     # Generate room codes
├── public/                  # Static files (served directly)
│   ├── index.html           # Single page app
│   ├── css/
│   │   ├── main.css         # Main styles + glassmorphism
│   │   ├── cards.css        # Card styling
│   │   └── animations.css   # All animations
│   ├── js/
│   │   ├── app.js           # Main app entry
│   │   ├── supabase-client.js # Supabase browser client
│   │   ├── state.js         # Game state management
│   │   ├── ui.js            # Screen rendering
│   │   ├── cards.js         # Card rendering
│   │   ├── api.js           # API calls
│   │   └── realtime.js      # Supabase realtime subscriptions
│   └── assets/
│       ├── yosemite.jpg     # Background image
│       └── cards/           # SVG card images (52 + back)
│           ├── 2_of_clubs.svg
│           ├── 2_of_diamonds.svg
│           ├── ... (all 52 cards)
│           └── back.svg
└── supabase/
    └── schema.sql           # Database schema for reference
```

---

## UI Screens (Mobile-First)

### 1. Home Screen
- Input: Name
- Buttons: "Create Game" / "Join Game"
- If active session detected: "Rejoin Game" button

### 2. Join Screen
- Input: Room code (6 characters)
- Button: "Join"

### 3. Lobby Screen
- Room code displayed (shareable)
- List of joined players
- "Start Game" button (creator only, 2-7 players)
- "Leave" button

### 4. Game Screen - Bidding Phase
- Trump card displayed prominently
- Your hand (cards fanned at bottom)
- Other players shown around "table"
- Bid selector (0 to current_round)
- Invalid bids grayed out (for last bidder)
- Show who has bid, waiting for whom

### 5. Game Screen - Playing Phase
- Trump card (smaller, corner)
- Current trick in center
- Your hand at bottom (tappable to play)
- Valid cards highlighted, invalid grayed
- Player indicators showing tricks won
- Current player highlighted

### 6. Round Summary Screen
- Show each player's bid vs actual
- Points earned this round
- Running total
- "Next Round" or auto-continue

### 7. Game End Screen
- Final scores
- Winner highlighted
- "Play Again" / "New Game" buttons

---

## Visual Design: Glassmorphism + Yosemite

### Design System
- **Background**: High-quality Yosemite scenic image (fixed, cover)
- **UI panels**: Glassmorphism effect
  - Semi-transparent white/light background
  - Backdrop blur (blur(20px))
  - Subtle border (1px rgba white)
  - Soft shadows
- **Colors**: Neutral palette that works over nature imagery
- **Typography**: Clean sans-serif (Inter or system fonts)

### Glassmorphism CSS
```css
.glass-panel {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

body {
  background: url('/assets/yosemite.jpg') center center / cover fixed;
  min-height: 100vh;
}
```

---

## Card Rendering (SVG-Based)

Using SVG card images for polished look:
- Source: Open-source SVG card deck (e.g., https://github.com/htdebeer/SVG-cards)
- Individual SVG files per card (52 cards + back)
- Crisp at any size, works on retina displays
- Cards displayed with subtle shadow for depth

```css
.card {
  width: 70px;
  height: 98px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease;
}

.card:active {
  transform: scale(0.95);
}

.card.selected {
  transform: translateY(-12px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.card img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
```

---

## Animation Strategy (Polished but Reliable)

### Philosophy
- **Reliability first**: Animations must never break game flow
- **CSS transitions over JS**: Hardware-accelerated, fewer bugs
- **Graceful degradation**: Game works without animations
- **State-driven**: Animations triggered by state changes, not timers

### Animations Included
| Action | Animation | Duration |
|--------|-----------|----------|
| Card dealt | Fade in + scale from 0.8 | 200ms |
| Card selected | Translate up 12px | 150ms |
| Card played | Move to trick pile | 300ms |
| Trick won | Cards slide to winner | 400ms |
| Bid submitted | Subtle pulse | 200ms |
| Player turn | Glow/highlight pulse | Loop |
| Screen transition | Fade | 250ms |

### Implementation Rules
1. Use CSS `transition` and `@keyframes`, not JS `setInterval`
2. All animations use `transform` and `opacity` only (GPU-accelerated)
3. Use `will-change` sparingly for known animated elements
4. Always include `prefers-reduced-motion` media query fallback
5. State changes wait for previous animation to complete (via `transitionend`)
6. Game logic never depends on animation timing

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Mobile UX Considerations

1. **Touch targets**: Minimum 44x44px for all tappable elements
2. **Card selection**: Tap to select, tap again or "Play" button to confirm
3. **Orientation**: Portrait primary, works in landscape
4. **No hover states**: Everything tap-based
5. **Large text**: Easy to read suits and ranks
6. **Swipe gestures**: Optional, not required
7. **Haptic feedback**: Vibrate on card play (if supported)
8. **Prevent zoom**: Viewport meta tag
9. **Fast taps**: No 300ms delay (touch-action: manipulation)

---

## Security Considerations

1. **Server-side validation**: All game logic runs on server
2. **Hand privacy**: Players only see their own cards
3. **Session tokens**: Not authentication, just reconnection IDs
4. **Rate limiting**: Prevent spam actions
5. **Input validation**: Sanitize names, validate moves

---

## Implementation Order

### Phase 1: Foundation (Files 1-5)
1. `package.json` - Initialize project with dependencies
2. `vercel.json` - Vercel configuration
3. `.gitignore` - Ignore env files, node_modules
4. `supabase/schema.sql` - Database schema
5. Run Supabase SQL to create tables

### Phase 2: Server Core (Files 6-12)
6. `api/_lib/supabase.js` - Supabase admin client
7. `api/_lib/room-code.js` - Generate unique room codes
8. `api/_lib/deck.js` - Create, shuffle, deal cards
9. `api/_lib/bidding.js` - Bid validation & restrictions
10. `api/_lib/tricks.js` - Trick resolution logic
11. `api/_lib/scoring.js` - Score calculation
12. `api/_lib/game-logic.js` - State machine orchestrating all logic

### Phase 3: API Endpoints (Files 13-20)
13. `api/games/create.js` - Create new game room
14. `api/games/join.js` - Join existing game
15. `api/games/[roomCode].js` - Get game state
16. `api/games/start.js` - Start game from lobby
17. `api/games/leave.js` - Leave game
18. `api/actions/bid.js` - Submit bid
19. `api/actions/play.js` - Play card
20. `api/session/active-game.js` - Check for active game

### Phase 4: Frontend Core (Files 21-27)
21. `public/index.html` - HTML structure
22. `public/css/main.css` - Base styles + glassmorphism
23. `public/css/cards.css` - Card styling
24. `public/css/animations.css` - All animations
25. `public/js/supabase-client.js` - Browser Supabase client
26. `public/js/api.js` - API wrapper functions
27. `public/js/state.js` - Client-side state management

### Phase 5: Frontend UI (Files 28-31)
28. `public/js/ui.js` - Screen rendering (home, lobby, game, etc.)
29. `public/js/cards.js` - Card rendering with SVGs
30. `public/js/realtime.js` - Supabase realtime subscriptions
31. `public/js/app.js` - Main entry, ties everything together

### Phase 6: Assets (Files 32-33)
32. Download/create SVG card deck (52 cards + back)
33. Source Yosemite background image

### Phase 7: Polish & Testing
34. Connection/disconnection handling
35. Reconnection flow (rejoin active games)
36. Error states and user feedback
37. Animation fine-tuning
38. Mobile testing & fixes
39. Cross-browser testing

---

## Confirmed Decisions

- **Supabase**: Fresh project created (user has credentials)
- **Hosting**: Vercel (serverless functions)
- **Cards**: SVG images for polished look
- **Visual style**: Glassmorphism with Yosemite background
- **Animations**: Polished but reliability-first (CSS-based)

---

## Summary

This plan covers:
- Complete game rules implementation
- Database schema for persistence
- Real-time multiplayer via Supabase
- Robust connection/disconnection handling
- Mobile-first responsive UI
- Full API specification
- Detailed file structure
- Step-by-step implementation order

Ready to proceed when approved.
