# Add Feature Workflow

When adding a new feature to Contract Whist, follow this checklist:

## 1. Understand the Request
- What gameplay aspect does this affect?
- Does it require backend changes, frontend changes, or both?

## 2. Backend Changes (if needed)
- [ ] Add handler in `api/_lib/handlers/` (room.js, game.js, or player.js)
- [ ] Add action case in `api/games.js` switch statement
- [ ] Update game-logic.js if it affects game state
- [ ] Add tests in `tests/comprehensive.test.js`
- [ ] Run `npm test` to verify

## 3. Frontend Changes (if needed)
- [ ] Add API method in `public/js/api.js`
- [ ] Update state handling in `public/js/state.js`
- [ ] Update UI rendering in `public/js/ui.js`
- [ ] Update event handlers in `public/js/app.js`
- [ ] Add CSS if needed in `public/css/main.css`

## 4. Test Manually
- [ ] Create a game
- [ ] Test the new feature
- [ ] Test with multiple players if applicable

## 5. Update Documentation
- [ ] Update CLAUDE.md if architecture changed
- [ ] Add any new conventions or patterns used
