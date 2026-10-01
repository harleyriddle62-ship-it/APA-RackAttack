import { useEffect, useState } from 'react';
import { api } from '../api.js';

const fmtDate = (v) =>
  v
    ? new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Date TBD';

export default function TeamDetail({ teamId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    api
      .team(teamId)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [teamId]);

  if (error) return <div className="alert">⚠️ {error}</div>;
  if (!data) return <div className="empty small">Loading team…</div>;

  const { team, league, players, matches, rank, record } = data;

  return (
    <div className="stack">
      <a className="back-link" href="#/">
        ← Back to standings
      </a>

      <div className="league-head">
        <h2>{team.name}</h2>
        <p className="muted">
          {league?.name}
          {league?.season ? ` · ${league.season}` : ''}
        </p>
      </div>

      <div className="stat-tiles">
        <Stat label="Rank" value={rank ? `#${rank}` : '—'} />
        <Stat label="Record" value={`${record.wins}–${record.losses}`} />
        <Stat label="Games played" value={record.played} />
        <Stat label="Points for / against" value={`${record.points_for} / ${record.points_against}`} />
      </div>

      <section className="panel">
        <h3 className="panel-title">Player performance</h3>
        {!players.length ? (
          <p className="muted">No players on this roster yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>P</th>
                  <th>W</th>
                  <th>L</th>
                  <th>Win %</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td className="team-name">{p.name}</td>
                    <td>{p.played}</td>
                    <td className="win">{p.wins}</td>
                    <td className="loss">{p.losses}</td>
                    <td>{p.win_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <h3 className="panel-title">Match history</h3>
        {!matches.length ? (
          <p className="muted">No matches scheduled yet.</p>
        ) : (
          <ul className="match-list">
            {matches.map((m) => (
              <li key={m.id} className={m.result ? 'match completed' : 'match'}>
                <div className="match-info">
                  <span className="match-teams">
                    vs {m.opponent_name} <em>{m.is_home ? 'home' : 'away'}</em>
                  </span>
                  <span className="muted small-text">{fmtDate(m.scheduled_at)}</span>
                </div>
                <div className="match-actions">
                  {m.result ? (
                    <>
                      <span className={m.result === 'W' ? 'badge badge-win' : 'badge badge-loss'}>
                        {m.result}
                      </span>
                      <span className="score-line">
                        {m.team_score}–{m.opponent_score}
                      </span>
                    </>
                  ) : (
                    <span className="badge badge-pending">Scheduled</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="panel stat-tile">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
