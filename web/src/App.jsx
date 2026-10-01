import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Standings from './components/Standings.jsx';
import Teams from './components/Teams.jsx';
import Schedule from './components/Schedule.jsx';
import TeamDetail from './components/TeamDetail.jsx';

const TABS = ['Standings', 'Teams', 'Schedule'];

/** Tiny hash router: the only non-list route is `#/team/:id`. */
function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return hash;
}

export default function App() {
  const [leagues, setLeagues] = useState([]);
  const [leagueId, setLeagueId] = useState(null);
  const [league, setLeague] = useState(null);
  const [tab, setTab] = useState('Standings');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewLeague, setShowNewLeague] = useState(false);

  const route = useHashRoute();
  const teamRoute = route.match(/^#\/team\/(\d+)$/);

  const loadLeagues = useCallback(async () => {
    const data = await api.leagues();
    setLeagues(data);
    setLeagueId((prev) =>
      prev && data.some((l) => l.id === prev) ? prev : data[0]?.id ?? null
    );
  }, []);

  const loadLeague = useCallback(async (id) => {
    if (!id) {
      setLeague(null);
      return;
    }
    setLeague(await api.league(id));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadLeagues();
        setError(null);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadLeagues]);

  useEffect(() => {
    if (!leagueId) {
      setLeague(null);
      return;
    }
    loadLeague(leagueId).catch((e) => setError(e.message));
  }, [leagueId, loadLeague]);

  const refresh = () => loadLeague(leagueId).catch((e) => setError(e.message));

  const createLeague = async (data) => {
    const created = await api.createLeague(data);
    await loadLeagues();
    setLeagueId(created.id);
    setShowNewLeague(false);
    setTab('Standings');
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">🎱</span>
          <div>
            <h1>APA RackAttack</h1>
            <p className="brand-sub">Amateur Pool League Manager</p>
          </div>
        </div>
        <div className="topbar-actions">
          {leagues.length > 0 && (
            <select
              className="league-select"
              value={leagueId ?? ''}
              onChange={(e) => setLeagueId(Number(e.target.value))}
            >
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn btn-primary" onClick={() => setShowNewLeague((v) => !v)}>
            + New league
          </button>
        </div>
      </header>

      {showNewLeague && (
        <NewLeagueForm onSubmit={createLeague} onCancel={() => setShowNewLeague(false)} />
      )}

      {error && <div className="alert">⚠️ {error}</div>}

      {teamRoute ? (
        <TeamDetail teamId={Number(teamRoute[1])} />
      ) : loading ? (
        <div className="empty">Loading leagues…</div>
      ) : !league ? (
        <div className="empty">
          <h2>No leagues yet</h2>
          <p>Create your first league to start tracking teams, matches and standings.</p>
        </div>
      ) : (
        <>
          <div className="league-head">
            <h2>{league.name}</h2>
            <p className="muted">
              {league.season || 'No season set'} · {league.teams.length} teams ·{' '}
              {league.matches.length} matches
            </p>
          </div>

          <nav className="tabs">
            {TABS.map((t) => (
              <button
                key={t}
                className={t === tab ? 'tab active' : 'tab'}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </nav>

          <main className="content">
            {tab === 'Standings' && <Standings league={league} />}
            {tab === 'Teams' && <Teams league={league} refresh={refresh} />}
            {tab === 'Schedule' && <Schedule league={league} refresh={refresh} />}
          </main>
        </>
      )}
    </div>
  );
}

function NewLeagueForm({ onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [season, setSeason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), season: season.trim() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel new-league" onSubmit={submit}>
      <input
        placeholder="League name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <input
        placeholder="Season (optional)"
        value={season}
        onChange={(e) => setSeason(e.target.value)}
      />
      <div className="row-actions">
        <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
          Create
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
