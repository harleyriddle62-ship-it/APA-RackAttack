import { pool, initSchema } from './db.js';

const TEAMS = [
  { name: 'Break Room Bandits', players: ['Danny R.', 'Marcus T.', 'Priya S.', 'Louie M.'] },
  { name: 'Corner Pocket Kings', players: ['Alvarez J.', 'Ken W.', 'Tasha B.', 'Ivan P.'] },
  { name: 'Chalk Dust Cowboys', players: ['Wes H.', 'Dana K.', 'Rico F.', 'Sam O.'] },
  { name: 'Eight Ball Assassins', players: ['Nina C.', 'Terrence L.', 'Gus V.', 'Maya D.'] },
  { name: 'Rail Runners', players: ['Owen B.', 'Claire N.', 'Hector Z.', 'Julia E.'] },
  { name: 'Snooker Sharks', players: ['Devin A.', 'Rosa G.', 'Carl M.', 'Yuki H.'] },
];

async function seed() {
  await initSchema();

  const { rows: existing } = await pool.query('SELECT count(*)::int AS n FROM leagues');
  if (existing[0].n > 0) {
    console.log('[seed] data already present, skipping');
    return;
  }

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
      const loser = p % 2 === 0 ? away : home;
      const winScore = 5;
      const loseScore = 1 + (p % 4); // 1..4
      const homeScore = winner === home ? winScore : loseScore;
      const awayScore = winner === away ? winScore : loseScore;
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

  console.log(`[seed] created league with ${teamIds.length} teams and ${pairings.length} matches`);
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('[seed] failed', err);
    pool.end().finally(() => process.exit(1));
  });
