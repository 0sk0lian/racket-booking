import { apiGet } from '../api';

export default async function DashboardPage() {
  const [clubs, courts, bookings, users] = await Promise.all([
    apiGet<any>('/clubs'), apiGet<any>('/courts'), apiGet<any>('/bookings'), apiGet<any>('/users'),
  ]);

  const confirmed = bookings.data?.filter((b: any) => b.status === 'confirmed') || [];
  const pending = bookings.data?.filter((b: any) => b.status === 'pending') || [];
  const totalRevenue = confirmed.reduce((s: number, b: any) => s + b.total_price, 0);
  const sportCounts: Record<string, number> = {};
  (courts.data || []).forEach((c: any) => { sportCounts[c.sport_type] = (sportCounts[c.sport_type] || 0) + 1; });

  const h = new Date().getHours();
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{greeting} &#x1F44B;</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 4 }}>
            {new Date().toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <StatCard label="Clubs" value={clubs.data?.length || 0} sub={`${clubs.data?.filter((c: any) => c.is_non_profit).length || 0} non-profit`} color="#6366f1" />
        <StatCard label="Active Courts" value={courts.data?.length || 0} sub={Object.entries(sportCounts).map(([k, v]) => `${v} ${k}`).join(', ')} color="#06b6d4" />
        <StatCard label="Bookings" value={confirmed.length} sub={`${pending.length} pending`} color="#10b981" />
        <StatCard label="Revenue" value={`${totalRevenue.toFixed(0)}`} sub="SEK from confirmed" color="#f59e0b" />
        <StatCard label="Players" value={users.data?.length || 0} sub="Active accounts" color="#8b5cf6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '5fr 3fr', gap: 20 }}>
        <div className="animate-in-2">
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14, color: 'var(--text)' }}>Recent Bookings</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Court</th><th>Player</th><th>Time</th><th>Price</th><th>Status</th></tr></thead>
              <tbody>
                {(bookings.data || []).slice(0, 8).map((b: any) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text)' }}>{b.court_name}</td>
                    <td>{b.booker_name}</td>
                    <td style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      {new Date(b.time_slot_start).toLocaleString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ fontWeight: 600 }}>{b.total_price?.toFixed(0)} <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: 12 }}>SEK</span></td>
                    <td><span className={`badge ${b.status === 'confirmed' ? 'badge-green' : b.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="animate-in-3" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Quick Info</h2>
          <InfoCard title="Court Utilization" icon="&#x1F3BE;">
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              {(courts.data || []).slice(0, 4).map((c: any) => {
                const n = (bookings.data || []).filter((b: any) => b.court_id === c.id && b.status !== 'cancelled').length;
                const pct = Math.min(n * 15, 100);
                return (
                  <div key={c.id} style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ height: 8, background: 'var(--bg-body)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-gradient)', borderRadius: 4, transition: 'width 0.8s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </InfoCard>
          <InfoCard title="VAT Summary" icon="&#x1F4B0;">
            <div style={{ marginTop: 14, fontSize: 13.5 }}>
              <Row label="Court Rental (6%)" value={`${(totalRevenue * 0.06 / 1.06).toFixed(0)} SEK`} />
              <Row label="Platform Fee (25%)" value={`${(totalRevenue * 0.05 * 0.25).toFixed(0)} SEK`} />
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Total VAT</span>
                <span style={{ fontWeight: 700, color: 'var(--yellow)' }}>{(totalRevenue * 0.06 / 1.06 + totalRevenue * 0.05 * 0.25).toFixed(0)} SEK</span>
              </div>
            </div>
          </InfoCard>
          <InfoCard title="Top Sports" icon="&#x1F3C6;">
            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(sportCounts).sort(([,a],[,b]) => b - a).map(([sport, count]) => (
                <span key={sport} className={`badge ${sport === 'padel' ? 'badge-blue' : sport === 'tennis' ? 'badge-green' : 'badge-yellow'}`}>
                  {sport} ({count})
                </span>
              ))}
            </div>
          </InfoCard>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value" style={{ color }}>{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}

function InfoCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
      padding: 20, boxShadow: 'var(--shadow-xs)', transition: 'all var(--bounce)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
