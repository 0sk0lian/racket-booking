'use client';
import { useEffect, useState } from 'react';
const API = '/api';

interface RevenueData { total: number; bookingCount: number; byDay: { date: string; revenue: number }[]; byCourt: { court: string; revenue: number }[]; byType: { type: string; revenue: number }[]; }
interface Club { id: string; name: string; }
const TYPE_LABELS: Record<string, string> = { regular: 'Bokning', training: 'Träning', contract: 'Kontrakt', event: 'Event' };
const TYPE_COLORS: Record<string, string> = { regular: '#10b981', training: '#6366f1', contract: '#f59e0b', event: '#ec4899' };

export default function RevenuePage() {
  const [clubs, setClubs] = useState<Club[]>([]); const [clubId, setClubId] = useState('');
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => { fetch(`${API}/clubs`).then(r => r.json()).then(r => { setClubs(r.data ?? []); if (r.data?.length) setClubId(r.data[0].id); }); }, []);
  useEffect(() => { if (!clubId) return; setLoading(true); fetch(`${API}/admin/revenue?clubId=${clubId}&from=${from}&to=${to}`).then(r => r.json()).then(r => { setData(r.data ?? null); setLoading(false); }); }, [clubId, from, to]);

  const maxDayRev = data ? Math.max(...data.byDay.map(d => d.revenue), 1) : 1;
  const exportCSV = () => { if (!data) return; const rows = ['Datum,Intäkt']; data.byDay.forEach(d => rows.push(`${d.date},${d.revenue}`)); const blob = new Blob([rows.join('\n')], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `intakter-${from}-${to}.csv`; a.click(); };

  return (
    <div>
      <div className="page-header"><h1>Intäkter</h1><button className="btn btn-outline" onClick={exportCSV}>Exportera CSV</button></div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Fld label="Klubb"><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
        <Fld label="Från"><input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inp} /></Fld>
        <Fld label="Till"><input type="date" value={to} onChange={e => setTo(e.target.value)} style={inp} /></Fld>
      </div>
      {loading ? <div className="loading">Laddar...</div> : data && (<>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
          <div style={card}><div style={cl}>Total intäkt</div><div style={{ fontSize: 32, fontWeight: 800, color: '#10b981' }}>{data.total.toFixed(0)} <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-dim)' }}>SEK</span></div></div>
          <div style={card}><div style={cl}>Bokningar</div><div style={{ fontSize: 32, fontWeight: 800, color: '#6366f1' }}>{data.bookingCount}</div><div style={{ fontSize: 12, color: 'var(--text-dim)' }}>snitt {data.bookingCount > 0 ? (data.total / data.bookingCount).toFixed(0) : 0} SEK/bokning</div></div>
        </div>
        <div style={{ ...card, marginBottom: 24 }}><div style={{ ...cl, marginBottom: 12 }}>Intäkt per dag</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>{data.byDay.map(d => (<div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }} title={`${d.date}: ${d.revenue.toFixed(0)} SEK`}><div style={{ width: '100%', maxWidth: 20, height: Math.max(2, (d.revenue / maxDayRev) * 100), background: '#6366f1', borderRadius: '3px 3px 0 0' }} /></div>))}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)', marginTop: 6 }}><span>{data.byDay[0]?.date}</span><span>{data.byDay[data.byDay.length - 1]?.date}</span></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={card}><div style={{ ...cl, marginBottom: 10 }}>Per bana</div>{data.byCourt.map(c => (<div key={c.court} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}><span style={{ fontSize: 13, fontWeight: 500 }}>{c.court}</span><span style={{ fontSize: 14, fontWeight: 700 }}>{c.revenue.toFixed(0)} SEK</span></div>))}</div>
          <div style={card}><div style={{ ...cl, marginBottom: 10 }}>Per typ</div>{data.byType.map(t => (<div key={t.type} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: TYPE_COLORS[t.type] ?? '#94a3b8' }} /><span style={{ fontSize: 13, fontWeight: 500 }}>{TYPE_LABELS[t.type] ?? t.type}</span></span><span style={{ fontSize: 14, fontWeight: 700 }}>{t.revenue.toFixed(0)} SEK</span></div>))}</div>
        </div>
      </>)}
    </div>
  );
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>{children}</div>; }
const inp: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', minWidth: 140 };
const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 };
const cl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 };
