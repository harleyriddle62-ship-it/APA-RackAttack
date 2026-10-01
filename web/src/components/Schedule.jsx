import { useState } from 'react';
import { api } from '../api.js';

const formatWhen = (value) =>
  value
    ? new Date(value).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Date TBD';

export default function Schedule({ league, refresh }) {
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);

  const teamName = (id) => league.teams.find((t) => t.id === id)?.name || 'Unknown';

  const addMatch = async (e) => {
    e.preventDefault();
    if (!home || !away || home === away) return;
    setBusy(true);
    try {
      await api.createMatch(league.id, {
        home_team_id: Number(home),
        away_team_id: Number(away),
        scheduled_at: when ? new Date(when).toISOString() : null,
      });
      setHome('');
      setAway('');
      setWhen('');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (league.teams.length < 2) {
    return <div className="empty small">Add at least two teams to schedule matches.</div>;
  }

  return (
    <div className="stack">
      <form className="panel inline-form" onSubmit={addMatch}>
        <select value={home} onChange={(e) => setHome(e.target.value)}>
          <option value="">Home team…</option>
          {league.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <span className="vs">vs</span>
        <select value={away} onChange={(e) => setAway(e.target.value)}>
          <option value="">Away team…</option>
          {league.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        <button className="btn btn-primary" disabled={busy || !home || !away || home === away}>
          Schedule
        </button>
      </form>

      {!league.matches.length ? (
        <div className="empty small">No matches scheduled yet.</div>
      ) : (
        <ul className="match-list">
          {league.matches.map((m) => (
            <MatchRow key={m.id} match={m} teamName={teamName} refresh={refresh} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MatchRow({ match, teamName, refresh }) {
  const [homeScore, setHomeScore] = useState(match.home_score ?? '');
  const [awayScore, setAwayScore] = useState(match.away_score ?? '');
  const [busy, setBusy] = useState(false);
  const completed = match.status === 'completed';

  const save = async () => {
    if (homeScore === '' || awayScore === '') return;
    setBusy(true);
    try {
      await api.updateMatch(match.id, {
        home_score: Number(homeScore),
        away_score: Number(awayScore),
        status: 'completed',
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    await api.deleteMatch(match.id);
    await refresh();
  };

  return (
    <li className={completed ? 'match completed' : 'match'}>
      <div className="match-info">
        <span className="match-teams">
          {teamName(match.home_team_id)} <em>vs</em> {teamName(match.away_team_id)}
        </span>
        <span className="muted small-text">{formatWhen(match.scheduled_at)}</span>
      </div>

      <div className="match-actions">
        <input
          className="score"
          type="number"
          min="0"
          value={homeScore}
          onChange={(e) => setHomeScore(e.target.value)}
          placeholder="–"
        />
        <span className="dash">–</span>
        <input
          className="score"
          type="number"
          min="0"
          value={awayScore}
          onChange={(e) => setAwayScore(e.target.value)}
          placeholder="–"
        />
        <button className="btn" onClick={save} disabled={busy || homeScore === '' || awayScore === ''}>
          Save
        </button>
        {completed && <span className="badge">Final</span>}
        <button className="btn btn-ghost danger" onClick={remove} title="Delete match">
          ✕
        </button>
      </div>
    </li>
  );
}
