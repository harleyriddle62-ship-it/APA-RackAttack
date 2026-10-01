import express from 'express';
import { pool, initSchema } from './db.js';
import { seedIfEmpty } from './seed.js';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

// Wrap async handlers so rejected promises become 500s instead of hanging.
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((err) => {
    console.error('[api]', err);
    res.status(500).json({ error: err.message });
  });

function computeStandings(teams, matches) {
  const table = teams.map((t) => ({
    team_id: t.id,
    name: t.name,
    played: 0,
    wins: 0,
    losses: 0,
    points_for: 0,
    points_against: 0,
  }));
  const byId = new Map(table.map((row) => [row.team_id, row]));

  for (const m of matches) {
    if (m.status !== 'completed' || m.home_score == null || m.away_score == null) continue;
    const home = byId.get(m.home_team_id);
    const away = byId.get(m.away_team_id);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.points_for += m.home_score;
    home.points_against += m.away_score;
    away.points_for += m.away_score;
    away.points_against += m.home_score;

    if (m.home_score > m.away_score) {
      home.wins += 1;
      away.losses += 1;
    } else if (m.away_score > m.home_score) {
      away.wins += 1;
      home.losses += 1;
    }
  }

  table.sort(
    (a, b) =>
      b.wins - a.wins ||
      b.points_for - b.points_against - (a.points_for - a.points_against) ||
      a.name.localeCompare(b.name)
  );
  return table;
}

app.get(
  '/api/health',
  wrap(async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  })
);

// --- Leagues ---
app.get(
  '/api/leagues',
  wrap(async (_req, res) => {
    const { rows } = await pool.query('SELECT * FROM leagues ORDER BY created_at DESC');
    res.json(rows);
  })
);

app.post(
  '/api/leagues',
  wrap(async (req, res) => {
    const { name, season } = req.body ?? {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'League name is required' });
    }
    const { rows } = await pool.query(
      'INSERT INTO leagues (name, season) VALUES ($1, $2) RETURNING *',
      [String(name).trim(), season ? String(season).trim() : null]
    );
    res.status(201).json(rows[0]);
  })
);

app.get(
  '/api/leagues/:id',
  wrap(async (req, res) => {
    const { id } = req.params;
    const league = (await pool.query('SELECT * FROM leagues WHERE id = $1', [id])).rows[0];
    if (!league) return res.status(404).json({ error: 'League not found' });

    const teams = (
      await pool.query('SELECT * FROM teams WHERE league_id = $1 ORDER BY name', [id])
    ).rows;
    const players = (
      await pool.query(
        `SELECT p.* FROM players p
           JOIN teams t ON t.id = p.team_id
          WHERE t.league_id = $1
          ORDER BY p.name`,
        [id]
      )
    ).rows;
    const matches = (
      await pool.query(
        'SELECT * FROM matches WHERE league_id = $1 ORDER BY scheduled_at NULLS LAST, id',
        [id]
      )
    ).rows;

    res.json({ ...league, teams, players, matches, standings: computeStandings(teams, matches) });
  })
);

// --- Teams ---
app.post(
  '/api/leagues/:id/teams',
  wrap(async (req, res) => {
    const { name } = req.body ?? {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }
    const { rows } = await pool.query(
      'INSERT INTO teams (league_id, name) VALUES ($1, $2) RETURNING *',
      [req.params.id, String(name).trim()]
    );
    res.status(201).json(rows[0]);
  })
);

app.delete(
  '/api/teams/:id',
  wrap(async (req, res) => {
    await pool.query('DELETE FROM teams WHERE id = $1', [req.params.id]);
    res.status(204).end();
  })
);

// --- Players ---
app.post(
  '/api/teams/:id/players',
  wrap(async (req, res) => {
    const { name } = req.body ?? {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Player name is required' });
    }
    const { rows } = await pool.query(
      'INSERT INTO players (team_id, name) VALUES ($1, $2) RETURNING *',
      [req.params.id, String(name).trim()]
    );
    res.status(201).json(rows[0]);
  })
);

app.delete(
  '/api/players/:id',
  wrap(async (req, res) => {
    await pool.query('DELETE FROM players WHERE id = $1', [req.params.id]);
    res.status(204).end();
  })
);

// --- Matches ---
app.post(
  '/api/leagues/:id/matches',
  wrap(async (req, res) => {
    const { home_team_id, away_team_id, scheduled_at } = req.body ?? {};
    if (!home_team_id || !away_team_id) {
      return res.status(400).json({ error: 'Both teams are required' });
    }
    if (Number(home_team_id) === Number(away_team_id)) {
      return res.status(400).json({ error: 'A team cannot play itself' });
    }
    const { rows } = await pool.query(
      `INSERT INTO matches (league_id, home_team_id, away_team_id, scheduled_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, home_team_id, away_team_id, scheduled_at || null]
    );
    res.status(201).json(rows[0]);
  })
);

app.patch(
  '/api/matches/:id',
  wrap(async (req, res) => {
    const body = req.body ?? {};
    const fields = [];
    const values = [];
    let i = 1;

    for (const key of ['scheduled_at', 'home_score', 'away_score', 'status']) {
      if (key in body) {
        fields.push(`${key} = $${i++}`);
        values.push(body[key]);
      }
    }

    if (
      body.home_score != null &&
      body.away_score != null &&
      !('status' in body)
    ) {
      fields.push(`status = $${i++}`);
      values.push('completed');
    }

    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });

    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE matches SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows[0]) return res.status(404).json({ error: 'Match not found' });
    res.json(rows[0]);
  })
);

app.delete(
  '/api/matches/:id',
  wrap(async (req, res) => {
    await pool.query('DELETE FROM matches WHERE id = $1', [req.params.id]);
    res.status(204).end();
  })
);

async function start() {
  await initSchema();
  await seedIfEmpty();
  app.listen(PORT, '0.0.0.0', () => console.log(`[api] listening on port ${PORT}`));
}

start().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});
