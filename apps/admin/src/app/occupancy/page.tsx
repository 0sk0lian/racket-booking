'use client';
import { useEffect, useState } from 'react';
const API = 'http://localhost:3001/api';

export default function OccupancyPage() {
  const [clubs, setClubs] = useState<any[]>([]); const [clubId, setClubId] = useState('');
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true);

  useEffect(() => { fetch(`${API}/clubs`).then(r => r.json()).then(r => { setClubs(r.data || []); if (r.data?.length) setClubId(r.data[0].id); }); }, []);
  useEffect(() => { if (!clubId) return; setLoading(true); fetch(`${API}/features/occupancy?clubId=${clubId}`).then(r => r.json()).then(r => { setData(r.data); setLoading(false); }); }, [clubId]);

  if (loading || !data) return <div className="loading">Loading...</div>;
  const avgOccupancy = data.courts.length > 0 ? Math.round(data.courts.reduce((s: number, c: any) => s + c.occupancyPct, 0) / data.courts.length) : 0;

  return (
    <div>
      <div className="page-header"><h1>Beläggning</h1></div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <Fld label="Klubb"><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)', alignSelf: 'flex-end' }}>{data.period.from} — {data.period.to} ({data.totalDays} dagar)</div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <div className="stat-card"><div className="label">Snitt beläggning</div><div className="value" style={{ color: avgOccupancy > 60 ? '#10b981' : avgOccupancy > 30 ? '#f59e0b' : '#ef4444' }}>{avgOccupancy}%</div></div>
        <div className="stat-card"><div className="label">Totalt bokade timmar</div><div className="value" style={{ color: '#6366f1' }}>{data.courts.reduce((s: number, c: any) => s + c.bookedHours, 0)}</div></div>
        <div className="stat-card"><div className="label">Totalt bokningar</div><div className="value" style={{ color: '#06b6d4' }}>{data.courts.reduce((s: number, c: any) => s + c.totalBookings, 0)}</div></div>
        <div className="stat-card"><div className="label">Banor</div><div className="value">{data.courts.length}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Per bana</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Bana</th><th>Sport</th><th>Bokade timmar</th><th>Bokningar</th><th>Beläggning</th><th>Visuellt</th></tr></thead>
              <tbody>
                {data.courts.map((c: any) => (
                  <tr key={c.courtId}>
                    <td style={{ fontWeight: 600 }}>{c.courtName}</td>
                    <td><span className={`badge ${c.sportType === 'padel' ? 'badge-blue' : 'badge-green'}`}>{c.sportType}</span></td>
                    <td>{c.bookedHours}h</td>
                    <td>{c.totalBookings}</td>
                    <td style={{ fontWeight: 700, color: c.occupancyPct > 60 ? '#10b981' : c.occupancyPct > 30 ? '#f59e0b' : '#ef4444' }}>{c.occupancyPct}%</td>
                    <td style={{ width: 120 }}><div style={{ height: 10, background: 'var(--bg-body)', borderRadius: 5, overflow: 'hidden' }}><div style={{ height: '100%', width: `${c.occupancyPct}%`, background: c.occupancyPct > 60 ? 'linear-gradient(90deg, #10b981, #06b6d4)' : c.occupancyPct > 30 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #ef4444, #f87171)', borderRadius: 5, transition: 'width 0.8s ease' }} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Per sport</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(data.bySport).map(([sport, d]: any) => (
              <div key={sport} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, boxShadow: 'var(--shadow-xs)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className={`badge ${sport === 'padel' ? 'badge-blue' : 'badge-green'}`} style={{ fontSize: 13 }}>{sport}</span>
                  <span style={{ fontWeight: 700, fontSize: 18 }}>{d.hours}h</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{d.bookings} bokningar</div>
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
