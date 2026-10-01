import express from 'express';
import { pool, initSchema } from './db.js';
import { backfillPlayerResultsIfEmpty, seedIfEmpty } from './seed.js';

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

    const playerResults = (
      await pool.query(
        `SELECT pr.* FROM player_results pr
           JOIN matches m ON m.id = pr.match_id
          WHERE m.league_id = $1`,
        [id]
      )
    ).rows;

    res.json({
      ...league,
      teams,
      players,
      matches: matches.map((m) => ({
        ...m,
        player_results: playerResults.filter((r) => r.match_id === m.id),
      })),
      standings: computeStandings(teams, matches),
    });
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

// --- Team detail (roster stats + match history) ---
app.get(
  '/api/teams/:id',
  wrap(async (req, res) => {
    const { id } = req.params;
    const team = (await pool.query('SELECT * FROM teams WHERE id = $1', [id])).rows[0];
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const league = (
      await pool.query('SELECT * FROM leagues WHERE id = $1', [team.league_id])
    ).rows[0];

    const players = (
      await pool.query(
        `SELECT p.id, p.name,
                count(pr.id)::int AS played,
                coalesce(sum(CASE WHEN pr.won THEN 1 ELSE 0 END), 0)::int AS wins
           FROM players p
           LEFT JOIN player_results pr ON pr.player_id = p.id
          WHERE p.team_id = $1
          GROUP BY p.id, p.name
          ORDER BY p.name`,
        [id]
      )
    ).rows.map((p) => ({
      ...p,
      losses: p.played - p.wins,
      win_pct: p.played ? Math.round((p.wins / p.played) * 100) : 0,
    }));

    const matches = (
      await pool.query(
        `SELECT m.*, opp.id AS opponent_id, opp.name AS opponent_name
           FROM matches m
           JOIN teams opp
             ON opp.id = CASE WHEN m.home_team_id = $1 THEN m.away_team_id ELSE m.home_team_id END
          WHERE m.home_team_id = $1 OR m.away_team_id = $1
          ORDER BY m.scheduled_at NULLS LAST, m.id`,
        [id]
      )
    ).rows.map((m) => {
      const isHome = m.home_team_id === Number(id);
      const teamScore = isHome ? m.home_score : m.away_score;
      const opponentScore = isHome ? m.away_score : m.home_score;
      let result = null;
      if (m.status === 'completed' && teamScore != null && opponentScore != null) {
        result = teamScore > opponentScore ? 'W' : teamScore < opponentScore ? 'L' : 'D';
      }
      return { ...m, is_home: isHome, team_score: teamScore, opponent_score: opponentScore, result };
    });

    const leagueTeams = (
      await pool.query('SELECT * FROM teams WHERE league_id = $1', [team.league_id])
    ).rows;
    const leagueMatches = (
      await pool.query('SELECT * FROM matches WHERE league_id = $1', [team.league_id])
    ).rows;
    const standings = computeStandings(leagueTeams, leagueMatches);
    const index = standings.findIndex((r) => r.team_id === Number(id));

    res.json({
      team,
      league,
      players,
      matches,
      rank: index >= 0 ? index + 1 : null,
      record:
        index >= 0
          ? standings[index]
          : { played: 0, wins: 0, losses: 0, points_for: 0, points_against: 0 },
    });
  })
);

// --- Per-match player results ---
app.put(
  '/api/matches/:id/player-results',
  wrap(async (req, res) => {
    const results = req.body?.results;
    if (!Array.isArray(results)) {
      return res.status(400).json({ error: 'results must be an array' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of results) {
        if (!r?.player_id) continue;
        await client.query(
          `INSERT INTO player_results (match_id, player_id, won)
           VALUES ($1, $2, $3)
           ON CONFLICT (match_id, player_id) DO UPDATE SET won = EXCLUDED.won`,
          [req.params.id, r.player_id, !!r.won]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ ok: true });
  })
);

async function start() {
  await initSchema();
  await seedIfEmpty();
  await backfillPlayerResultsIfEmpty();
  app.listen(PORT, '0.0.0.0', () => console.log(`[api] listening on port ${PORT}`));
}

start().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});
