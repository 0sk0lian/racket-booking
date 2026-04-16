import { apiGet } from '../api';

export default async function TournamentsPage() {
  const res = await apiGet<any>('/tournaments');
  const tournaments = res.data || [];

  return (
    <div>
      <div className="page-header"><h1>Tournaments</h1></div>

      {tournaments.length === 0 ? (
        <div className="empty-state">
          <p style={{fontSize:48,marginBottom:16}}>⚑</p>
          <h3 style={{marginBottom:8}}>No tournaments yet</h3>
          <p>Create an Americano or Mexicano tournament via the API.</p>
          <pre style={{
            background:'var(--bg-card)', border:'1px solid var(--border)',
            borderRadius:8, padding:16, marginTop:16, textAlign:'left',
            display:'inline-block', fontSize:13, color:'var(--text-muted)'
          }}>
{`POST /api/tournaments
{
  "clubId": "<club-id>",
  "name": "Friday Americano",
  "sportType": "padel",
  "format": "americano",
  "playerIds": ["<id1>", "<id2>", "<id3>", "<id4>",
                "<id5>", "<id6>", "<id7>", "<id8>"]
}`}
          </pre>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Format</th><th>Sport</th><th>Players</th><th>Rounds</th><th>Status</th></tr></thead>
            <tbody>
              {tournaments.map((t: any) => (
                <tr key={t.id}>
                  <td style={{fontWeight:600}}>{t.name}</td>
                  <td><span className="badge badge-blue">{t.format}</span></td>
                  <td>{t.sport_type}</td>
                  <td>{t.player_ids?.length}</td>
                  <td>{t.schedule?.length || 0}</td>
                  <td><span className={`badge ${t.status === 'active' ? 'badge-green' : t.status === 'completed' ? 'badge-blue' : 'badge-yellow'}`}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
