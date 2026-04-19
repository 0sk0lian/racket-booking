'use client';
import { useEffect, useState } from 'react';
const API = '/api';

interface OccupancyData {
  courts: { id: string; name: string }[];
  heatmap: { court_id: string; court_name: string; hour: number; count: number; percentage: number }[];
  days: number;
  overall_occupancy: number;
  peak_hours: number[];
  dead_hours: number[];
  suggestions: string[];
}
interface Club { id: string; name: string; }

export default function OccupancyPage() {
  const [clubs, setClubs] = useState<Club[]>([]); const [clubId, setClubId] = useState('');
  const [data, setData] = useState<OccupancyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => new Date(Date.now() - 28 * 86400000).toISOString().split('T')[0]);
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => { fetch(`${API}/clubs`).then(r => r.json()).then(r => { setClubs(r.data ?? []); if (r.data?.length) setClubId(r.data[0].id); }); }, []);
  useEffect(() => { if (!clubId) return; setLoading(true); fetch(`${API}/admin/occupancy?clubId=${clubId}&from=${from}&to=${to}`).then(r => r.json()).then(r => { setData(r.data ?? null); setLoading(false); }); }, [clubId, from, to]);

  const getCell = (courtId: string, hour: number) => data?.heatmap.find(h => h.court_id === courtId && h.hour === hour);

  const heatColor = (pct: number) => {
    if (pct >= 80) return { bg: '#059669', color: '#fff' };
    if (pct >= 60) return { bg: '#10b981', color: '#fff' };
    if (pct >= 40) return { bg: '#6ee7b7', color: '#065f46' };
    if (pct >= 20) return { bg: '#d1fae5', color: '#065f46' };
    if (pct > 0) return { bg: '#f0fdf4', color: '#6b7280' };
    return { bg: '#f8fafc', color: '#cbd5e1' };
  };

  const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);

  return (
    <div>
      <div className="page-header"><h1>Beläggning</h1></div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Fld label="Klubb"><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
        <Fld label="Från"><input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inp} /></Fld>
        <Fld label="Till"><input type="date" value={to} onChange={e => setTo(e.target.value)} style={inp} /></Fld>
        {data && <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>{data.days} dagar · {data.overall_occupancy}% total beläggning</div>}
      </div>

      {loading ? <div className="loading">Laddar...</div> : data && (<>
        {/* Overall stat */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
          <div style={card}><div style={cl}>Total beläggning</div><div style={{ fontSize: 36, fontWeight: 800, color: data.overall_occupancy >= 60 ? '#059669' : data.overall_occupancy >= 30 ? '#f59e0b' : '#ef4444' }}>{data.overall_occupancy}%</div></div>
          <div style={card}><div style={cl}>Topp-timmar</div><div style={{ fontSize: 14 }}>{data.peak_hours.length > 0 ? data.peak_hours.map(h => `${String(h).padStart(2, '0')}:00`).join(', ') : 'Inga'}</div></div>
          <div style={card}><div style={cl}>Svaga timmar</div><div style={{ fontSize: 14 }}>{data.dead_hours.length > 0 ? data.dead_hours.map(h => `${String(h).padStart(2, '0')}:00`).join(', ') : 'Inga'}</div></div>
        </div>

        {/* Heatmap grid */}
        <div style={{ ...card, overflowX: 'auto', marginBottom: 20 }}>
          <div style={{ ...cl, marginBottom: 12 }}>Beläggning per bana och timme (senaste {data.days} dagar)</div>
          <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${HOURS.length}, 1fr)`, gap: 2, minWidth: HOURS.length * 44 + 140 }}>
            {/* Header */}
            <div />
            {HOURS.map(h => <div key={h} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', padding: '4px 0' }}>{String(h).padStart(2, '0')}</div>)}

            {/* Rows */}
            {data.courts.map(court => (
              <div key={court.id} style={{ display: 'contents' }}>
                <div style={{ fontSize: 12, fontWeight: 600, padding: '8px 0', display: 'flex', alignItems: 'center' }}>{court.name}</div>
                {HOURS.map(h => {
                  const cell = getCell(court.id, h);
                  const pct = cell?.percentage ?? 0;
                  const c = heatColor(pct);
                  return (
                    <div key={h} style={{ background: c.bg, color: c.color, borderRadius: 4, padding: '6px 2px', textAlign: 'center', fontSize: 11, fontWeight: 600, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={`${court.name} ${String(h).padStart(2, '0')}:00: ${pct}% (${cell?.count ?? 0} bokningar / ${data.days} dagar)`}>
                      {pct > 0 ? `${pct}%` : '·'}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, fontSize: 10, color: 'var(--text-dim)' }}>
            {[0, 20, 40, 60, 80].map(p => {
              const c = heatColor(p || 1);
              return <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: c.bg, border: '1px solid #e2e8f0' }} />{p}%+</span>;
            })}
          </div>
        </div>

        {/* Suggestions */}
        {data.suggestions.length > 0 && (
          <div style={{ ...card, borderColor: '#fef3c7', background: '#fffbeb' }}>
            <div style={{ ...cl, color: '#b45309' }}>Förslag</div>
            {data.suggestions.map((s, i) => (
              <div key={i} style={{ fontSize: 13, color: '#92400e', padding: '4px 0', display: 'flex', gap: 8 }}>
                <span>💡</span> {s}
              </div>
            ))}
          </div>
        )}
      </>)}
    </div>
  );
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>{children}</div>; }
const inp: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', minWidth: 140 };
const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, flex: 1 };
const cl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 };
