import { useState } from 'react';
import { api } from '../api.js';

export default function PlayerResults({ match, players, homeName, awayName, onSaved }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState(() => {
    const initial = {};
    for (const r of match.player_results ?? []) initial[r.player_id] = r.won;
    return initial;
  });

  const home = players.filter((p) => p.team_id === match.home_team_id);
  const away = players.filter((p) => p.team_id === match.away_team_id);
  const recorded = (match.player_results ?? []).length;

  const set = (playerId, won) => setValues((v) => ({ ...v, [playerId]: won }));

  const save = async () => {
    const results = Object.entries(values)
      .filter(([, won]) => typeof won === 'boolean')
      .map(([playerId, won]) => ({ player_id: Number(playerId), won }));
    if (!results.length) return;

    setBusy(true);
    try {
      await api.savePlayerResults(match.id, { results });
      await onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="player-results">
      <button
        type="button"
        className="btn btn-ghost small-btn"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '▾' : '▸'} Player results{recorded ? ` (${recorded})` : ''}
      </button>

      {open && (
        <div className="player-results-body">
          <div className="results-columns">
            <Roster title={homeName} roster={home} values={values} onSet={set} />
            <Roster title={awayName} roster={away} values={values} onSet={set} />
          </div>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            Save results
          </button>
        </div>
      )}
    </div>
  );
}

function Roster({ title, roster, values, onSet }) {
  return (
    <div className="roster-block">
      <h4>{title}</h4>
      {!roster.length ? (
        <p className="muted small-text">No players</p>
      ) : (
        <ul className="roster-list">
          {roster.map((p) => (
            <li key={p.id}>
              <span>{p.name}</span>
              <span className="toggle-group">
                <button
                  type="button"
                  className={values[p.id] === true ? 'toggle win active' : 'toggle win'}
                  onClick={() => onSet(p.id, true)}
                >
                  W
                </button>
                <button
                  type="button"
                  className={values[p.id] === false ? 'toggle loss active' : 'toggle loss'}
                  onClick={() => onSet(p.id, false)}
                >
                  L
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
