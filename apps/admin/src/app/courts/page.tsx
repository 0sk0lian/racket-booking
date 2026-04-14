import { apiGet } from '../api';

export default async function CourtsPage() {
  const res = await apiGet<any>('/courts');
  const courts = res.data || [];

  const sportColors: Record<string, string> = { padel: 'badge-blue', tennis: 'badge-green', squash: 'badge-yellow', badminton: 'badge-red' };

  return (
    <div>
      <div className="page-header"><h1>Courts</h1></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Club</th><th>Sport</th><th>Indoor</th><th>Rate/hr</th><th>Status</th></tr></thead>
          <tbody>
            {courts.map((c: any) => (
              <tr key={c.id}>
                <td style={{fontWeight:600}}>{c.name}</td>
                <td>{c.club_name}</td>
                <td><span className={`badge ${sportColors[c.sport_type] || 'badge-blue'}`}>{c.sport_type}</span></td>
                <td>{c.is_indoor ? 'Indoor' : 'Outdoor'}</td>
                <td>{c.base_hourly_rate} SEK</td>
                <td><span className="badge badge-green">Active</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
