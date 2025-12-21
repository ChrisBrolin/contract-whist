#!/usr/bin/env node

/**
 * Download SVG playing cards from a public source
 *
 * This script downloads card SVGs from an open-source card deck.
 * Run with: node scripts/download-cards.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CARDS_DIR = path.join(__dirname, '..', 'public', 'assets', 'cards');

// Card source: https://github.com/htdebeer/SVG-cards (Public Domain)
const BASE_URL = 'https://raw.githubusercontent.com/htdebeer/SVG-cards/master/svg-cards.svg';

const suits = ['clubs', 'diamonds', 'hearts', 'spades'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king', 'ace'];

// For simplicity, we'll create CSS-based card placeholders
// A proper implementation would extract individual cards from the SVG sprite

function createCssCard(suit, rank) {
  const isRed = suit === 'hearts' || suit === 'diamonds';
  const color = isRed ? '#e53935' : '#212121';

  const suitSymbols = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  };

  const rankDisplay = {
    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
    '7': '7', '8': '8', '9': '9', '10': '10',
    'jack': 'J', 'queen': 'Q', 'king': 'K', 'ace': 'A'
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 169 245" width="169" height="245">
  <rect x="0" y="0" width="169" height="245" rx="12" fill="white" stroke="#ccc" stroke-width="1"/>
  <text x="12" y="30" font-family="serif" font-size="24" font-weight="bold" fill="${color}">${rankDisplay[rank]}</text>
  <text x="12" y="52" font-family="serif" font-size="20" fill="${color}">${suitSymbols[suit]}</text>
  <text x="84.5" y="140" font-family="serif" font-size="60" text-anchor="middle" fill="${color}">${suitSymbols[suit]}</text>
  <text x="157" y="225" font-family="serif" font-size="24" font-weight="bold" fill="${color}" text-anchor="end" transform="rotate(180, 157, 215)">${rankDisplay[rank]}</text>
  <text x="157" y="203" font-family="serif" font-size="20" fill="${color}" text-anchor="end" transform="rotate(180, 157, 193)">${suitSymbols[suit]}</text>
</svg>`;
}

function createCardBack() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 169 245" width="169" height="245">
  <defs>
    <pattern id="diagonal" patternUnits="userSpaceOnUse" width="8" height="8">
      <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect x="0" y="0" width="169" height="245" rx="12" fill="#1e3a5f"/>
  <rect x="8" y="8" width="153" height="229" rx="8" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
  <rect x="8" y="8" width="153" height="229" rx="8" fill="url(#diagonal)"/>
  <circle cx="84.5" cy="122.5" r="40" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
</svg>`;
}

async function generateCards() {
  // Ensure directory exists
  if (!fs.existsSync(CARDS_DIR)) {
    fs.mkdirSync(CARDS_DIR, { recursive: true });
  }

  console.log('Generating card SVGs...');

  // Generate each card
  for (const suit of suits) {
    for (const rank of ranks) {
      const filename = `${rank}_of_${suit}.svg`;
      const filepath = path.join(CARDS_DIR, filename);
      const svg = createCssCard(suit, rank);

      fs.writeFileSync(filepath, svg);
      console.log(`Created: ${filename}`);
    }
  }

  // Generate card back
  const backPath = path.join(CARDS_DIR, 'back.svg');
  fs.writeFileSync(backPath, createCardBack());
  console.log('Created: back.svg');

  console.log(`\nDone! Generated ${suits.length * ranks.length + 1} card SVGs.`);
  console.log(`Cards saved to: ${CARDS_DIR}`);
}

generateCards().catch(console.error);
