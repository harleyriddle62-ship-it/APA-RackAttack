import { useMemo } from 'react';

const COLORS = ['#2fbf6b', '#e2b04a', '#5aa9e6', '#ef6f6c', '#b98cf0', '#4fd1c5'];

const W = 720;
const H = 260;
const PAD = { top: 16, right: 20, bottom: 36, left: 36 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const fmtDate = (v) =>
  new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' });

export default function TrendChart({ league }) {
  const { games, series, maxWins } = useMemo(() => {
    const teams = league.teams ?? [];

    const games = [...(league.matches ?? [])]
      .filter((m) => m.status === 'completed' && m.home_score != null && m.away_score != null)
      .sort(
        (a, b) =>
          new Date(a.scheduled_at ?? a.created_at) - new Date(b.scheduled_at ?? b.created_at)
      );

    // Cumulative wins per team, one point per completed match in date order.
    const totals = new Map(teams.map((t) => [t.id, 0]));
    const series = new Map(teams.map((t) => [t.id, [0]]));

    for (const m of games) {
      if (m.home_score > m.away_score) {
        totals.set(m.home_team_id, (totals.get(m.home_team_id) ?? 0) + 1);
      } else if (m.away_score > m.home_score) {
        totals.set(m.away_team_id, (totals.get(m.away_team_id) ?? 0) + 1);
      }
      for (const t of teams) series.get(t.id).push(totals.get(t.id) ?? 0);
    }

    return {
      games,
      series,
      maxWins: Math.max(1, ...teams.map((t) => totals.get(t.id) ?? 0)),
    };
  }, [league]);

  if (!games.length) {
    return (
      <section className="panel">
        <h3 className="panel-title">Season trend</h3>
        <p className="muted">Record a match result to see how teams track over the season.</p>
      </section>
    );
  }

  const x = (i) => PAD.left + (i / games.length) * PLOT_W;
  const y = (v) => PAD.top + PLOT_H - (v / maxWins) * PLOT_H;
  const yTicks = Array.from({ length: maxWins + 1 }, (_, i) => i);

  return (
    <section className="panel">
      <h3 className="panel-title">Cumulative wins over the season</h3>

      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Cumulative wins per team across the season"
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={PAD.left - 10} y={y(t) + 3} textAnchor="end" className="chart-axis">
              {t}
            </text>
          </g>
        ))}

        {games.map((m, i) => (
          <text
            key={m.id}
            x={x(i + 1)}
            y={H - PAD.bottom + 18}
            textAnchor="middle"
            className={i % 2 === 1 ? 'chart-axis hide-sm' : 'chart-axis'}
          >
            {fmtDate(m.scheduled_at ?? m.created_at)}
          </text>
        ))}

        {league.teams.map((team, idx) => {
          const values = series.get(team.id);
          const color = COLORS[idx % COLORS.length];
          const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
          const last = values.length - 1;

          return (
            <g key={team.id}>
              <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={x(last)} cy={y(values[last])} r="3.5" fill={color} />
            </g>
          );
        })}
      </svg>

      <ul className="chart-legend">
        {league.teams.map((team, idx) => (
          <li key={team.id} className="legend-item">
            <span
              className="legend-swatch"
              style={{ background: COLORS[idx % COLORS.length] }}
            />
            {team.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
