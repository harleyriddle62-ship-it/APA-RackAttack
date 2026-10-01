import { pool } from './db.js';

const TEAMS = [
  { name: 'Break Room Bandits', players: ['Danny R.', 'Marcus T.', 'Priya S.', 'Louie M.'] },
  { name: 'Corner Pocket Kings', players: ['Alvarez J.', 'Ken W.', 'Tasha B.', 'Ivan P.'] },
  { name: 'Chalk Dust Cowboys', players: ['Wes H.', 'Dana K.', 'Rico F.', 'Sam O.'] },
  { name: 'Eight Ball Assassins', players: ['Nina C.', 'Terrence L.', 'Gus V.', 'Maya D.'] },
  { name: 'Rail Runners', players: ['Owen B.', 'Claire N.', 'Hector Z.', 'Julia E.'] },
  { name: 'Snooker Sharks', players: ['Devin A.', 'Rosa G.', 'Carl M.', 'Yuki H.'] },
];

/**
 * Insert demo data the first time the database is empty. Called on every API
 * boot and cheap to run — it is a no-op once any league exists.
 */
export async function seedIfEmpty() {
  const { rows: existing } = await pool.query('SELECT count(*)::int AS n FROM leagues');
  if (existing[0].n > 0) return;

  const { rows: leagueRows } = await pool.query(
    'INSERT INTO leagues (name, season) VALUES ($1, $2) RETURNING id',
    ['APA RackAttack — Fall 2026 8-Ball', 'Fall 2026']
  );
  const leagueId = leagueRows[0].id;

  const teamIds = [];
  for (const team of TEAMS) {
    const { rows } = await pool.query(
      'INSERT INTO teams (league_id, name) VALUES ($1, $2) RETURNING id',
      [leagueId, team.name]
    );
    const teamId = rows[0].id;
    teamIds.push(teamId);
    for (const player of team.players) {
      await pool.query('INSERT INTO players (team_id, name) VALUES ($1, $2)', [teamId, player]);
    }
  }

  // Round-robin pairings: play the first 9, leave the rest on the schedule.
  const pairings = [];
  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      pairings.push([teamIds[i], teamIds[j]]);
    }
  }

  const now = Date.now();
  let played = 0;
  for (let p = 0; p < pairings.length; p++) {
    const [home, away] = pairings[p];
    if (played < 9) {
      const winner = p % 2 === 0 ? home : away;
      const homeScore = winner === home ? 5 : 1 + (p % 4);
      const awayScore = winner === away ? 5 : 1 + (p % 4);
      const when = new Date(now - (9 - played) * 36 * 3600 * 1000);
      await pool.query(
        `INSERT INTO matches (league_id, home_team_id, away_team_id, scheduled_at, home_score, away_score, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'completed')`,
        [leagueId, home, away, when.toISOString(), homeScore, awayScore]
      );
      played += 1;
    } else {
      const when = new Date(now + (p - 8) * 24 * 3600 * 1000);
      await pool.query(
        `INSERT INTO matches (league_id, home_team_id, away_team_id, scheduled_at, status)
         VALUES ($1, $2, $3, $4, 'scheduled')`,
        [leagueId, home, away, when.toISOString()]
      );
    }
  }

  console.log(`[seed] created demo league with ${teamIds.length} teams and ${pairings.length} matches`);
}

/**
 * Give the seeded completed matches some per-player results so the team detail
 * page has something to show. Runs once — skipped as soon as any result exists.
 */
export async function backfillPlayerResultsIfEmpty() {
  const { rows: existing } = await pool.query('SELECT count(*)::int AS n FROM player_results');
  if (existing[0].n > 0) return;

  const { rows: matches } = await pool.query(
    `SELECT * FROM matches
      WHERE status = 'completed' AND home_score IS NOT NULL AND away_score IS NOT NULL
      ORDER BY id`
  );
  if (!matches.length) return;

  for (const m of matches) {
    const homeWon = m.home_score > m.away_score;

    for (const teamId of [m.home_team_id, m.away_team_id]) {
      const { rows: players } = await pool.query(
        'SELECT id FROM players WHERE team_id = $1 ORDER BY id',
        [teamId]
      );
      if (!players.length) continue;

      const teamWon = teamId === m.home_team_id ? homeWon : !homeWon;
      const oddIndex = m.id % players.length;

      for (let i = 0; i < players.length; i++) {
        const won = teamWon ? i !== oddIndex : i === oddIndex;
        await pool.query(
          `INSERT INTO player_results (match_id, player_id, won)
           VALUES ($1, $2, $3)
           ON CONFLICT (match_id, player_id) DO NOTHING`,
          [m.id, players[i].id, won]
        );
      }
    }
  }

  console.log(`[seed] backfilled player results for ${matches.length} completed matches`);
}
