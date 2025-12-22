# Run Tests

Run the test suite to verify game logic:

```bash
npm test
```

This runs:
- `tests/game-logic.test.js` - Basic unit tests
- `tests/comprehensive.test.js` - Full game simulations (161+ tests)

## Test Coverage

The tests cover:
- Deck creation and shuffling
- Card dealing
- Bid validation (including last bidder restriction)
- Trick resolution (all trump scenarios)
- Score calculation (+1/trick, +10 bonus)
- Full game simulations with random play
- Edge cases (2-7 players, rounds 1-7)

## Adding New Tests

Add tests to `tests/comprehensive.test.js` following this pattern:

```javascript
// In the appropriate section
test('Description of what you are testing', () => {
  // Setup
  // Action
  // Assert with assert.strictEqual() or assert()
});
```
