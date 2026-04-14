'use client';
import { useEffect, useState } from 'react';
const API = 'http://localhost:3001/api';

export default function SickLeavePage() {
  const [clubs, setClubs] = useState<any[]>([]); const [clubId, setClubId] = useState('');
  const [data, setData] = useState<any[]>([]); const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); const [toast, setToast] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [fUser, setFUser] = useState(''); const [fNote, setFNote] = useState('');

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  useEffect(() => { Promise.all([fetch(`${API}/clubs`).then(r => r.json()), fetch(`${API}/users`).then(r => r.json())]).then(([c, u]) => { setClubs(c.data || []); setUsers(u.data?.filter((x: any) => x.role === 'trainer') || []); if (c.data?.length) setClubId(c.data[0].id); }); }, []);

  const reload = async () => { if (!clubId) return; setLoading(true); const r = await fetch(`${API}/features/sick-leave?clubId=${clubId}`).then(r => r.json()); setData(r.data || []); setLoading(false); };
  useEffect(() => { reload(); }, [clubId]);

  const report = async () => {
    await fetch(`${API}/features/sick-leave`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: fUser, clubId, startDate: new Date().toISOString().split('T')[0], note: fNote, coverageNeeded: true }) });
    flash('Sjukanmälan registrerad — notis skickad till tillgängliga tränare'); setShowReport(false); setFNote(''); await reload();
  };

  const cover = async (id: string) => {
    const coverer = prompt('User ID som tar över (välj från listan):');
    if (!coverer) return;
    await fetch(`${API}/features/sick-leave/${id}/cover`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: coverer }) });
    flash('Vikarier tilldelad'); await reload();
  };

  const active = data.filter(s => s.status === 'active');
  const history = data.filter(s => s.status !== 'active');

  return (
    <div>
      <div className="page-header"><h1>Sjukanmälan</h1><button className="btn btn-primary" onClick={() => setShowReport(!showReport)}>{showReport ? 'Avbryt' : '+ Sjukanmäl'}</button></div>
      {toast && <div className="toast">{toast}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <Fld label="Klubb"><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
      </div>

      {showReport && (
        <div className="form-card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Ny sjukanmälan</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <Fld label="Anställd"><select value={fUser} onChange={e => setFUser(e.target.value)} style={inp}><option value="">Välj...</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></Fld>
            <Fld label="Anteckning"><input value={fNote} onChange={e => setFNote(e.target.value)} style={inp} placeholder="T.ex. förkyld" /></Fld>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>Systemet skickar automatiskt notis till alla tillgängliga tränare om att det finns timmar som behöver täckas.</p>
          <button className="btn btn-primary" onClick={report}>Registrera sjukanmälan</button>
        </div>
      )}

      {loading ? <div className="loading">Loading...</div> : <>
        {active.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14, color: 'var(--red)' }}>Aktiva sjukanmälningar ({active.length})</h2>
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {active.map((s: any) => (
                <div key={s.id} style={{ background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 14, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--red)' }}>{s.user_name}</h3>
                    <span className="badge badge-red">Aktiv</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Sedan: {s.start_date}</div>
                  {s.note && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{s.note}</div>}
                  <div style={{ fontSize: 13, color: 'var(--yellow)', fontWeight: 600, marginBottom: 8 }}>{s.affected_sessions} pass behöver vikarier</div>
                  {s.coverage_needed && <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => cover(s.id)}>Tilldela vikarie</button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Historik</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Anställd</th><th>Från</th><th>Till</th><th>Anteckning</th><th>Status</th><th>Vikarie</th></tr></thead>
                <tbody>
                  {history.map((s: any) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.user_name}</td>
                      <td>{s.start_date}</td>
                      <td>{s.end_date || '—'}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{s.note || '—'}</td>
                      <td><span className={`badge ${s.status === 'covered' ? 'badge-green' : 'badge-yellow'}`}>{s.status}</span></td>
                      <td>{s.covered_by_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>}
    </div>
  );
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.7px' }}>{label}</label>{children}</div>; }
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'inherit' };
