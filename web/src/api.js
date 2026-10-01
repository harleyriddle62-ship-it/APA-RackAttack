async function request(url, options) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  leagues: () => request('/api/leagues'),
  league: (id) => request(`/api/leagues/${id}`),
  createLeague: (data) =>
    request('/api/leagues', { method: 'POST', body: JSON.stringify(data) }),

  team: (id) => request(`/api/teams/${id}`),

  createTeam: (leagueId, data) =>
    request(`/api/leagues/${leagueId}/teams`, { method: 'POST', body: JSON.stringify(data) }),
  deleteTeam: (id) => request(`/api/teams/${id}`, { method: 'DELETE' }),

  addPlayer: (teamId, data) =>
    request(`/api/teams/${teamId}/players`, { method: 'POST', body: JSON.stringify(data) }),
  deletePlayer: (id) => request(`/api/players/${id}`, { method: 'DELETE' }),

  createMatch: (leagueId, data) =>
    request(`/api/leagues/${leagueId}/matches`, { method: 'POST', body: JSON.stringify(data) }),
  updateMatch: (id, data) =>
    request(`/api/matches/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteMatch: (id) => request(`/api/matches/${id}`, { method: 'DELETE' }),
  savePlayerResults: (matchId, data) =>
    request(`/api/matches/${matchId}/player-results`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};
