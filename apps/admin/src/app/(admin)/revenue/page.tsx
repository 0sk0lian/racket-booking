'use client';
import { useEffect, useState } from 'react';
const API = '/api';

export default function RevenuePage() {
  const [clubs, setClubs] = useState<any[]>([]);
  const [clubId, setClubId] = useState('');
  const [period, setPeriod] = useState('day');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch(`${API}/clubs`).then(r => r.json()).then(r => { setClubs(r.data || []); if (r.data?.length) setClubId(r.data[0].id); }); }, []);
  useEffect(() => { if (!clubId) return; setLoading(true); fetch(`${API}/features/revenue?clubId=${clubId}&period=${period}`).then(r => r.json()).then(r => { setData(r.data); setLoading(false); }); }, [clubId, period]);

  if (loading || !data) return <div className="loading">Loading revenue...</div>;
  const maxRev = Math.max(...data.timeline.map((t: any) => t.revenue), 1);

  return (
    <div>
      <div className="page-header"><h1>Revenue</h1></div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-end' }}>
        <Fld label="Club"><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
        <Fld label="Period">
          <div style={{ display: 'flex', gap: 4 }}>
            {['day', 'week', 'month', 'year'].map(p => (
              <button key={p} className={`btn ${period === p ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '8px 14px', fontSize: 12, textTransform: 'capitalize' as const }} onClick={() => setPeriod(p)}>{p === 'day' ? 'Dag' : p === 'week' ? 'Vecka' : p === 'month' ? 'Månad' : 'År'}</button>
            ))}
          </div>
        </Fld>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card"><div className="label">Total Omsättning</div><div className="value" style={{ color: '#10b981' }}>{data.totalRevenue.toLocaleString()}</div><div className="sub">SEK</div></div>
        <div className="stat-card"><div className="label">Bokningar</div><div className="value" style={{ color: '#6366f1' }}>{data.totalBookings}</div></div>
        <div className="stat-card"><div className="label">Snitt per bokning</div><div className="value" style={{ color: '#f59e0b' }}>{data.totalBookings > 0 ? Math.round(data.totalRevenue / data.totalBookings) : 0}</div><div className="sub">SEK</div></div>
        <div className="stat-card"><div className="label">Perioder</div><div className="value" style={{ color: '#06b6d4' }}>{data.timeline.length}</div></div>
      </div>

      {/* Revenue chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Omsättning per {period === 'day' ? 'dag' : period === 'week' ? 'vecka' : period === 'month' ? 'månad' : 'år'}</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 200 }}>
            {data.timeline.map((t: any, i: number) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{t.revenue.toLocaleString()}</span>
                <div style={{ width: '100%', maxWidth: 48, height: `${(t.revenue / maxRev) * 160}px`, minHeight: 4, background: 'linear-gradient(180deg, #6366f1, #06b6d4)', borderRadius: '6px 6px 0 0', transition: 'height 0.6s ease' }} />
                <span style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{t.period}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* By type */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Per bokningstyp</h3>
            {Object.entries(data.byType).map(([type, rev]: any) => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13 }}>
                <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>{type}</span>
                <span style={{ fontWeight: 600 }}>{rev.toLocaleString()} SEK</span>
              </div>
            ))}
          </div>

          {/* By court */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Per bana</h3>
            {data.byCourt.map((c: any) => (
              <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', fontSize: 13 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{c.name}</span>
                <span style={{ fontWeight: 600 }}>{c.revenue.toLocaleString()} SEK <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>({c.bookings})</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.7px' }}>{label}</label>{children}</div>; }
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'inherit' };
