'use client';
import { useEffect, useState } from 'react';
const API = 'http://localhost:3001/api';
const DAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];
const DAY_IDX = [1, 2, 3, 4, 5, 6, 0];

export default function EmployeeSchedulePage() {
  const [clubs, setClubs] = useState<any[]>([]); const [clubId, setClubId] = useState('');
  const [data, setData] = useState<any[]>([]); const [loading, setLoading] = useState(true);

  useEffect(() => { fetch(`${API}/clubs`).then(r => r.json()).then(r => { setClubs(r.data || []); if (r.data?.length) setClubId(r.data[0].id); }); }, []);
  useEffect(() => { if (!clubId) return; setLoading(true); fetch(`${API}/features/employee-schedule?clubId=${clubId}`).then(r => r.json()).then(r => { setData(r.data || []); setLoading(false); }); }, [clubId]);

  return (
    <div>
      <div className="page-header"><h1>Tränares Schema</h1></div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <Fld label="Klubb"><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
      </div>

      {loading ? <div className="loading">Loading...</div> : data.map((trainer: any) => (
        <div key={trainer.userId} style={{ marginBottom: 28, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          {/* Header */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>{trainer.name.split(' ').map((n: string) => n[0]).join('')}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{trainer.name} {trainer.isSick && <span className="badge badge-red" style={{ marginLeft: 8 }}>Sjuk</span>}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{trainer.sportTypes?.join(', ')} &middot; {trainer.hourlyRate} SEK/h &middot; {trainer.totalWeeklyHours}h/vecka</div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{trainer.upcomingsessions?.length || 0} kommande pass</div>
          </div>

          {/* Weekly grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
            {DAYS.map(d => <div key={d} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', borderRight: '1px solid #f1f5f9' }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 60 }}>
            {DAY_IDX.map((dayNum, i) => {
              const sessions = trainer.weeklyTemplates?.filter((t: any) => t.dayOfWeek === dayNum) || [];
              return (
                <div key={i} style={{ padding: 6, borderRight: '1px solid #f1f5f9', minHeight: 60 }}>
                  {sessions.map((s: any) => (
                    <div key={s.id} style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6, padding: '4px 8px', marginBottom: 4, fontSize: 11 }}>
                      <div style={{ fontWeight: 600, color: '#4f46e5' }}>{String(s.startHour).padStart(2, '0')}-{String(s.endHour).padStart(2, '0')}</div>
                      <div style={{ color: '#6366f1', fontSize: 10 }}>{s.title}</div>
                      <div style={{ color: 'var(--text-dim)', fontSize: 9.5 }}>{s.courtName}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Upcoming */}
          {trainer.upcomingsessions?.length > 0 && (
            <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-body)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Kommande bokade pass</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {trainer.upcomingsessions.map((s: any) => (
                  <span key={s.id} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, background: '#fff', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                    {new Date(s.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} — {s.court}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.7px' }}>{label}</label>{children}</div>; }
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'inherit' };
