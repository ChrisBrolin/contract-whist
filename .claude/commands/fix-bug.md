# Fix Bug Workflow

When fixing a bug in Contract Whist:

## 1. Reproduce the Bug
- What screen/phase does it occur on?
- What are the steps to reproduce?
- What is expected vs actual behavior?

## 2. Locate the Code
Common bug locations by symptom:

**Game logic bugs:**
- `api/_lib/game-logic.js` - State machine, round management
- `api/_lib/bidding.js` - Bid validation, last bidder restriction
- `api/_lib/tricks.js` - Card play validation, trick resolution
- `api/_lib/scoring.js` - Score calculation

**API bugs:**
- `api/_lib/handlers/` - Request handling
- `api/games.js` - Route configuration

**UI bugs:**
- `public/js/ui.js` - Rendering issues
- `public/js/state.js` - State management
- `public/css/main.css` - Layout/styling

**Realtime bugs:**
- `public/js/realtime.js` - Subscription handling

## 3. Write a Test First
- Add a failing test in `tests/comprehensive.test.js`
- This prevents regression

## 4. Fix the Bug
- Make minimal changes to fix the issue
- Don't refactor or add features

## 5. Verify
- [ ] Run `npm test` - all tests pass
- [ ] Manually test the fix
- [ ] Test related functionality didn't break
