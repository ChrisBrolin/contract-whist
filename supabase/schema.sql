-- Contract Whist Database Schema
-- Run this in your Supabase SQL Editor

-- Games table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code VARCHAR(6) UNIQUE NOT NULL,
  creator_session_id VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'lobby' CHECK (status IN ('lobby', 'playing', 'finished', 'abandoned')),
  current_round INTEGER DEFAULT 7 CHECK (current_round >= 1 AND current_round <= 7),
  current_phase VARCHAR(20) DEFAULT 'waiting' CHECK (current_phase IN ('waiting', 'bidding', 'playing', 'round_end', 'game_end')),
  dealer_index INTEGER DEFAULT 0,
  current_player_index INTEGER,
  trump_suit VARCHAR(10) CHECK (trump_suit IN ('hearts', 'diamonds', 'clubs', 'spades', NULL)),
  trump_card JSONB,
  deck JSONB,
  current_trick JSONB DEFAULT '[]',
  trick_number INTEGER DEFAULT 0,
  lead_player_index INTEGER,
  round_scores JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: Add round_scores column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'round_scores') THEN
    ALTER TABLE games ADD COLUMN round_scores JSONB;
  END IF;
END $$;

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  session_id VARCHAR(100) NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0 AND position <= 6),
  hand JSONB DEFAULT '[]',
  current_bid INTEGER CHECK (current_bid >= 0 OR current_bid IS NULL),
  tricks_won_this_round INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  is_connected BOOLEAN DEFAULT TRUE,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, position),
  UNIQUE(game_id, session_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_room_code ON games(room_code);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_players_session_id ON players(session_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for games table
DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE players;

-- Row Level Security (RLS)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read games (needed for joining)
CREATE POLICY "Games are viewable by everyone" ON games
  FOR SELECT USING (true);

-- Policy: Anyone can insert games (create game)
CREATE POLICY "Anyone can create games" ON games
  FOR INSERT WITH CHECK (true);

-- Policy: Anyone can update games (game logic runs server-side with service key)
CREATE POLICY "Anyone can update games" ON games
  FOR UPDATE USING (true);

-- Policy: Anyone can read players in a game
CREATE POLICY "Players are viewable by everyone" ON players
  FOR SELECT USING (true);

-- Policy: Anyone can insert players (join game)
CREATE POLICY "Anyone can join games" ON players
  FOR INSERT WITH CHECK (true);

-- Policy: Anyone can update players
CREATE POLICY "Anyone can update players" ON players
  FOR UPDATE USING (true);

-- Policy: Anyone can delete players (leave game)
CREATE POLICY "Anyone can leave games" ON players
  FOR DELETE USING (true);
