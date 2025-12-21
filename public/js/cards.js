/**
 * Card Rendering
 */

const Cards = {
  // Suit symbols
  SUIT_SYMBOLS: {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  },

  // Rank display
  RANK_DISPLAY: {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
    11: 'J', 12: 'Q', 13: 'K', 14: 'A'
  },

  // SVG paths
  SVG_BASE_PATH: '/assets/cards/',

  /**
   * Get SVG filename for a card
   */
  getSvgFilename(card) {
    const rankNames = {
      2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
      11: 'jack', 12: 'queen', 13: 'king', 14: 'ace'
    };
    return `${rankNames[card.rank]}_of_${card.suit}.svg`;
  },

  /**
   * Create card element
   */
  createCard(card, options = {}) {
    const {
      clickable = true,
      selected = false,
      disabled = false,
      showBack = false,
      useCss = false,
      dealing = false
    } = options;

    const div = document.createElement('div');
    div.className = 'card';

    if (showBack) {
      div.classList.add('card-back');
      return div;
    }

    if (selected) div.classList.add('selected');
    if (disabled) div.classList.add('disabled');
    if (dealing) div.classList.add('dealing');
    if (!clickable) div.style.cursor = 'default';

    // Store card data
    div.dataset.suit = card.suit;
    div.dataset.rank = card.rank;

    if (useCss) {
      // CSS-only card (fallback)
      div.classList.add('css-card', card.suit);
      div.innerHTML = `
        <span class="rank">${this.RANK_DISPLAY[card.rank]}</span>
        <span class="suit">${this.SUIT_SYMBOLS[card.suit]}</span>
        <span class="rank">${this.RANK_DISPLAY[card.rank]}</span>
      `;
    } else {
      // SVG card
      const img = document.createElement('img');
      img.src = this.SVG_BASE_PATH + this.getSvgFilename(card);
      img.alt = `${this.RANK_DISPLAY[card.rank]} of ${card.suit}`;
      img.loading = 'lazy';

      // Fallback to CSS card on error
      img.onerror = () => {
        div.classList.add('css-card', card.suit);
        div.innerHTML = `
          <span class="rank">${this.RANK_DISPLAY[card.rank]}</span>
          <span class="suit">${this.SUIT_SYMBOLS[card.suit]}</span>
          <span class="rank">${this.RANK_DISPLAY[card.rank]}</span>
        `;
      };

      div.appendChild(img);
    }

    return div;
  },

  /**
   * Create card back element
   */
  createCardBack(options = {}) {
    const { mini = false } = options;

    const div = document.createElement('div');
    div.className = mini ? 'mini-card-back' : 'card card-back';
    return div;
  },

  /**
   * Create mini card stack (for showing card count)
   */
  createMiniCardStack(count) {
    const container = document.createElement('div');
    container.className = 'mini-card-stack';

    // Show up to 3 stacked backs
    const stackCount = Math.min(count, 3);
    for (let i = 0; i < stackCount; i++) {
      container.appendChild(this.createCardBack({ mini: true }));
    }

    // Card count badge
    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'card-count';
      badge.textContent = count;
      container.appendChild(badge);
    }

    return container;
  },

  /**
   * Create trump card display
   */
  createTrumpDisplay(card) {
    const container = document.createElement('div');
    container.className = 'mini-card';

    if (!card) {
      container.textContent = '-';
      return container;
    }

    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    container.style.color = isRed ? '#e53935' : '#212121';
    container.innerHTML = `
      <span style="font-size: 0.75rem;">${this.RANK_DISPLAY[card.rank]}</span>
      <span>${this.SUIT_SYMBOLS[card.suit]}</span>
    `;

    return container;
  },

  /**
   * Create suit symbol
   */
  createSuitSymbol(suit) {
    const span = document.createElement('span');
    span.className = `suit-symbol ${suit}`;
    return span;
  },

  /**
   * Render hand to container
   */
  renderHand(container, cards, options = {}) {
    const {
      onCardClick = null,
      selectedCard = null,
      validCards = null,
      dealing = false
    } = options;

    container.innerHTML = '';

    cards.forEach((card, index) => {
      const isSelected = selectedCard &&
        selectedCard.suit === card.suit &&
        selectedCard.rank === card.rank;

      const isValid = !validCards || validCards.some(
        c => c.suit === card.suit && c.rank === card.rank
      );

      const cardEl = this.createCard(card, {
        selected: isSelected,
        disabled: !isValid,
        dealing: dealing,
        clickable: !!onCardClick && isValid
      });

      if (dealing) {
        cardEl.style.animationDelay = `${index * 50}ms`;
      }

      if (onCardClick && isValid) {
        cardEl.addEventListener('click', () => onCardClick(card));
      }

      container.appendChild(cardEl);
    });
  },

  /**
   * Render trick to container
   */
  renderTrick(container, trick, players) {
    container.innerHTML = '';

    trick.forEach((play, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'trick-card';
      wrapper.style.setProperty('--rotation', `${(index - 1) * 5}deg`);

      const cardEl = this.createCard(play.card, { clickable: false });
      cardEl.classList.add('appearing');

      // Player label
      const player = players.find(p => p.id === play.playerId);
      if (player) {
        const label = document.createElement('span');
        label.className = 'player-label';
        label.textContent = player.name;
        wrapper.appendChild(label);
      }

      wrapper.appendChild(cardEl);
      container.appendChild(wrapper);
    });
  },

  /**
   * Create bid display
   */
  createBidDisplay(bid) {
    const div = document.createElement('div');
    div.className = 'bid-display';
    div.textContent = bid !== null ? bid : '?';
    return div;
  },

  /**
   * Create tricks won display
   */
  createTricksWonDisplay(count) {
    const container = document.createElement('div');
    container.className = 'tricks-won';

    for (let i = 0; i < count; i++) {
      const token = document.createElement('div');
      token.className = 'trick-token';
      container.appendChild(token);
    }

    return container;
  },

  /**
   * Sort cards by suit then rank
   */
  sortCards(cards) {
    const suitOrder = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
    return [...cards].sort((a, b) => {
      if (suitOrder[a.suit] !== suitOrder[b.suit]) {
        return suitOrder[a.suit] - suitOrder[b.suit];
      }
      return b.rank - a.rank;
    });
  }
};

window.Cards = Cards;
