export default function Standings({ league }) {
  const rows = league.standings ?? [];

  if (!rows.length) {
    return <div className="empty small">Add teams to see standings.</div>;
  }

  return (
    <section className="panel">
      <h3 className="panel-title">League standings</h3>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>P</th>
              <th>W</th>
              <th>L</th>
              <th>PF</th>
              <th>PA</th>
              <th>Diff</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const diff = r.points_for - r.points_against;
              return (
                <tr key={r.team_id}>
                  <td className="rank">{i + 1}</td>
                  <td className="team-name">{r.name}</td>
                  <td>{r.played}</td>
                  <td className="win">{r.wins}</td>
                  <td className="loss">{r.losses}</td>
                  <td>{r.points_for}</td>
                  <td>{r.points_against}</td>
                  <td className={diff > 0 ? 'win' : diff < 0 ? 'loss' : ''}>
                    {diff > 0 ? '+' : ''}
                    {diff}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
