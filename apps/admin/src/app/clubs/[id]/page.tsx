import { apiGet } from '../../api';
import Link from 'next/link';

export default async function ClubDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await apiGet<any>(`/clubs/${id}`);
  const club = res.data;
  if (!club) return <div className="empty-state">Club not found</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/clubs" style={{ fontSize: 13, color: 'var(--text-dim)' }}>← Back to Clubs</Link>
          <h1 style={{ marginTop: 8 }}>{club.name}</h1>
        </div>
        <span className={`badge ${club.is_non_profit ? 'badge-blue' : 'badge-green'}`}>
          {club.is_non_profit ? 'Non-Profit (0% VAT)' : 'Commercial (6% VAT)'}
        </span>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="label">City</div><div className="value" style={{fontSize:20}}>{club.city || '—'}</div></div>
        <div className="stat-card"><div className="label">Org Number</div><div className="value" style={{fontSize:20}}>{club.organization_number}</div></div>
        <div className="stat-card"><div className="label">Courts</div><div className="value" style={{fontSize:20}}>{club.courts?.length || 0}</div></div>
        <div className="stat-card"><div className="label">Bookings</div><div className="value" style={{fontSize:20}}>{club.bookingCount || 0}</div></div>
      </div>

      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Courts</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Sport</th><th>Indoor</th><th>Hourly Rate</th><th>IoT Device</th></tr></thead>
          <tbody>
            {(club.courts || []).map((c: any) => (
              <tr key={c.id}>
                <td style={{fontWeight:600}}>{c.name}</td>
                <td><span className="badge badge-blue">{c.sport_type}</span></td>
                <td>{c.is_indoor ? 'Yes' : 'No'}</td>
                <td>{c.base_hourly_rate} SEK</td>
                <td style={{color:'var(--text-dim)'}}>{c.hardware_relay_id || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
