import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://rackattack:rackattack_dev_pw@db:5432/rackattack',
});

export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leagues (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      season     TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS teams (
      id         SERIAL PRIMARY KEY,
      league_id  INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS players (
      id         SERIAL PRIMARY KEY,
      team_id    INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS matches (
      id           SERIAL PRIMARY KEY,
      league_id    INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      home_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      away_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      scheduled_at TIMESTAMPTZ,
      home_score   INTEGER,
      away_score   INTEGER,
      status       TEXT NOT NULL DEFAULT 'scheduled',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS player_results (
      id        SERIAL PRIMARY KEY,
      match_id  INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      won       BOOLEAN NOT NULL DEFAULT false,
      UNIQUE (match_id, player_id)
    );
  `);
}
