import { apiGet } from '../api';

export default async function BookingsPage() {
  const res = await apiGet<any>('/bookings');
  const bookings = res.data || [];

  return (
    <div>
      <div className="page-header"><h1>Bookings</h1></div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Confirmed</div>
          <div className="value" style={{color:'var(--green)'}}>{bookings.filter((b: any) => b.status === 'confirmed').length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Pending</div>
          <div className="value" style={{color:'var(--yellow)'}}>{bookings.filter((b: any) => b.status === 'pending').length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Cancelled</div>
          <div className="value" style={{color:'var(--red)'}}>{bookings.filter((b: any) => b.status === 'cancelled').length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Revenue</div>
          <div className="value">{bookings.filter((b: any) => b.status !== 'cancelled').reduce((s: number, b: any) => s + b.total_price, 0).toFixed(0)} SEK</div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Court</th><th>Club</th><th>Player</th><th>Date</th><th>Time</th><th>Price</th><th>PIN</th><th>Split</th><th>Status</th></tr></thead>
          <tbody>
            {bookings.map((b: any) => (
              <tr key={b.id}>
                <td style={{fontWeight:600}}>{b.court_name}</td>
                <td>{b.club_name}</td>
                <td>{b.booker_name}</td>
                <td>{new Date(b.time_slot_start).toLocaleDateString('sv-SE')}</td>
                <td>{new Date(b.time_slot_start).toLocaleTimeString('sv-SE', {hour:'2-digit',minute:'2-digit'})} — {new Date(b.time_slot_end).toLocaleTimeString('sv-SE', {hour:'2-digit',minute:'2-digit'})}</td>
                <td>{b.total_price?.toFixed(0)} SEK</td>
                <td style={{fontFamily:'monospace',color:'var(--accent)'}}>{b.access_pin || '—'}</td>
                <td>{b.is_split_payment ? <span className="badge badge-blue">Split</span> : '—'}</td>
                <td><span className={`badge ${b.status === 'confirmed' ? 'badge-green' : b.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}>{b.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
