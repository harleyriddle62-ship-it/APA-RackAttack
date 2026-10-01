import { useState } from 'react';
import { api } from '../api.js';

export default function Teams({ league, refresh }) {
  const [teamName, setTeamName] = useState('');
  const [busy, setBusy] = useState(false);

  const playersByTeam = league.players.reduce((acc, p) => {
    (acc[p.team_id] ||= []).push(p);
    return acc;
  }, {});

  const addTeam = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    setBusy(true);
    try {
      await api.createTeam(league.id, { name: teamName.trim() });
      setTeamName('');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <form className="panel inline-form" onSubmit={addTeam}>
        <input
          placeholder="New team name"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
        <button className="btn btn-primary" disabled={busy || !teamName.trim()}>
          Add team
        </button>
      </form>

      {!league.teams.length ? (
        <div className="empty small">No teams yet — add one above.</div>
      ) : (
        <div className="grid">
          {league.teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              players={playersByTeam[team.id] || []}
              refresh={refresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamCard({ team, players, refresh }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const addPlayer = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.addPlayer(team.id, { name: name.trim() });
      setName('');
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const removePlayer = async (id) => {
    await api.deletePlayer(id);
    await refresh();
  };

  const removeTeam = async () => {
    if (!window.confirm(`Delete ${team.name} and its players?`)) return;
    await api.deleteTeam(team.id);
    await refresh();
  };

  return (
    <div className="panel card">
      <div className="card-head">
        <h3>{team.name}</h3>
        <button className="btn btn-ghost danger" onClick={removeTeam} title="Delete team">
          ✕
        </button>
      </div>

      <ul className="player-list">
        {players.map((p) => (
          <li key={p.id}>
            <span>{p.name}</span>
            <button
              className="btn btn-ghost"
              onClick={() => removePlayer(p.id)}
              title="Remove player"
            >
              ✕
            </button>
          </li>
        ))}
        {!players.length && <li className="muted">No players yet</li>}
      </ul>

      <form className="inline-form compact" onSubmit={addPlayer}>
        <input placeholder="Add player" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn" disabled={busy || !name.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}
