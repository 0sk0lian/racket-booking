'use client';
import { useEffect, useState } from 'react';
const API = '/api';

export default function TimeReportsPage() {
  const [clubs, setClubs] = useState<any[]>([]); const [clubId, setClubId] = useState('');
  const [data, setData] = useState<any>(null); const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); const [toast, setToast] = useState('');

  // Manual add
  const [showAdd, setShowAdd] = useState(false);
  const [fUser, setFUser] = useState(''); const [fDate, setFDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [fHours, setFHours] = useState('2'); const [fType, setFType] = useState('training'); const [fDesc, setFDesc] = useState('');

  // Sync with schedule
  const [syncUser, setSyncUser] = useState('');
  const [syncDate, setSyncDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [syncing, setSyncing] = useState(false); const [syncResult, setSyncResult] = useState<any>(null);

  // Salary summary
  const [salaryUser, setSalaryUser] = useState('');
  const [salaryFrom, setSalaryFrom] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; });
  const [salaryTo, setSalaryTo] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; });
  const [salaryData, setSalaryData] = useState<any>(null); const [salaryLoading, setSalaryLoading] = useState(false);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };
  const trainers = users.filter(u => u.role === 'trainer');

  useEffect(() => { Promise.all([fetch(`${API}/clubs`).then(r => r.json()), fetch(`${API}/users`).then(r => r.json())]).then(([c, u]) => { setClubs(c.data || []); setUsers(u.data || []); if (c.data?.length) setClubId(c.data[0].id); }); }, []);

  const reload = async () => { if (!clubId) return; setLoading(true); const r = await fetch(`${API}/features/time-reports?clubId=${clubId}`).then(r => r.json()); setData(r.data); setLoading(false); };
  useEffect(() => { reload(); }, [clubId]);

  const handleAdd = async () => {
    await fetch(`${API}/features/time-reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: fUser, clubId, date: fDate, hours: Number(fHours), type: fType, description: fDesc }) });
    flash('Timmar rapporterade'); setShowAdd(false); setFDesc(''); await reload();
  };
  const approve = async (id: string) => { await fetch(`${API}/features/time-reports/${id}/approve`, { method: 'PATCH' }); flash('Godkänd'); await reload(); };

  const handleSync = async () => {
    if (!syncUser) return; setSyncing(true); setSyncResult(null);
    const r = await fetch(`${API}/features/time-reports/sync-schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: syncUser, clubId, date: syncDate }) }).then(r => r.json());
    if (r.success) { flash(`${r.data.created} pass synkade — ${r.data.totalHours}h, ${r.data.totalPay.toLocaleString()} SEK`); setSyncResult(r.data); await reload(); }
    else flash('Fel: ' + r.error);
    setSyncing(false);
  };

  const loadSalary = async () => {
    if (!salaryUser) return; setSalaryLoading(true);
    const r = await fetch(`${API}/features/time-reports/salary-summary?userId=${salaryUser}&clubId=${clubId}&from=${salaryFrom}&to=${salaryTo}`).then(r => r.json());
    setSalaryData(r.data); setSalaryLoading(false);
  };

  // Per-trainer summary
  const trainerSummary: Record<string, { name: string; hours: number; approved: number; pending: number }> = {};
  data?.reports?.forEach((r: any) => {
    if (!trainerSummary[r.user_id]) trainerSummary[r.user_id] = { name: r.user_name, hours: 0, approved: 0, pending: 0 };
    trainerSummary[r.user_id].hours += r.hours;
    r.approved ? trainerSummary[r.user_id].approved += r.hours : trainerSummary[r.user_id].pending += r.hours;
  });

  const catLabels: Record<string, string> = { junior: 'Junior', adult: 'Vuxen', competition: 'Tävling', camp: 'Läger', other: 'Övrigt' };
  const catColors: Record<string, string> = { junior: '#06b6d4', adult: '#10b981', competition: '#ef4444', camp: '#ec4899', other: '#64748b' };

  return (
    <div>
      <div className="page-header">
        <h1>Tidrapportering</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Avbryt' : '+ Rapportera timmar'}</button>
      </div>
      {toast && <div className="toast">{toast}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <Fld label="Klubb"><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
      </div>

      {/* ─── Rapportera timmar panel (all-in-one) ─── */}
      {showAdd && (
        <div className="form-card" style={{ animation: 'fadeUp 0.3s ease both' }}>

          {/* Synca med schema — compact */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Synca med schema</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Hittar schemalagda pass, beräknar timmar per kategori med rätt timlön</p>
            </div>
            <Fld label="Tränare"><select value={syncUser} onChange={e => setSyncUser(e.target.value)} style={{ ...inp, minWidth: 160 }}><option value="">Välj...</option>{trainers.map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Fld>
            <Fld label="Datum"><input type="date" value={syncDate} onChange={e => setSyncDate(e.target.value)} style={inp} /></Fld>
            <button className="btn btn-primary" onClick={handleSync} disabled={syncing || !syncUser} style={{ padding: '9px 20px', background: 'linear-gradient(135deg, #10b981, #06b6d4)', boxShadow: '0 2px 8px rgba(16,185,129,0.25)', whiteSpace: 'nowrap' as const }}>
              {syncing ? 'Syncar...' : 'Synca dag'}
            </button>
          </div>

          {syncResult && (
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, padding: 14, marginBottom: 20, animation: 'fadeUp 0.3s ease both' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#059669', marginBottom: 6 }}>{syncResult.created} pass synkade — {syncResult.totalHours}h, {syncResult.totalPay.toLocaleString()} SEK</div>
              {syncResult.reports?.map((r: any) => (
                <div key={r.id} style={{ fontSize: 13, padding: '3px 0', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{r.session_title} <span style={{ color: catColors[r.category] || '#64748b', fontWeight: 600 }}>({catLabels[r.category] || r.category})</span></span>
                  <span style={{ fontWeight: 600 }}>{r.hours}h × {r.rate} = {r.pay.toLocaleString()} SEK</span>
                </div>
              ))}
            </div>
          )}

          {/* Manuell tidrapport */}
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-muted)' }}>Eller lägg till manuellt</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 12 }}>
            <Fld label="Anställd"><select value={fUser} onChange={e => setFUser(e.target.value)} style={inp}><option value="">Välj...</option>{trainers.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></Fld>
            <Fld label="Datum"><input type="date" value={fDate} onChange={e => setFDate(e.target.value)} style={inp} /></Fld>
            <Fld label="Timmar"><input type="number" min="0.5" step="0.5" value={fHours} onChange={e => setFHours(e.target.value)} style={inp} /></Fld>
            <Fld label="Typ"><select value={fType} onChange={e => setFType(e.target.value)} style={inp}><option value="training">Träning</option><option value="admin">Administration</option><option value="event">Evenemang</option><option value="other">Övrigt</option></select></Fld>
            <Fld label="Beskrivning"><input value={fDesc} onChange={e => setFDesc(e.target.value)} style={inp} placeholder="Vad gjordes?" /></Fld>
          </div>
          <button className="btn btn-outline" onClick={handleAdd} style={{ fontSize: 13 }}>Spara manuell tidrapport</button>
        </div>
      )}

      {/* ─── Lönekalkyl (always visible, compact) ─── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 24, boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Lönekalkyl</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 14 }}>
          <Fld label="Tränare"><select value={salaryUser} onChange={e => setSalaryUser(e.target.value)} style={inp}><option value="">Välj tränare...</option>{trainers.map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Fld>
          <Fld label="Från"><input type="date" value={salaryFrom} onChange={e => setSalaryFrom(e.target.value)} style={inp} /></Fld>
          <Fld label="Till"><input type="date" value={salaryTo} onChange={e => setSalaryTo(e.target.value)} style={inp} /></Fld>
          <button className="btn btn-primary" onClick={loadSalary} disabled={salaryLoading || !salaryUser} style={{ padding: '9px 24px' }}>{salaryLoading ? 'Beräknar...' : 'Beräkna lön'}</button>
        </div>

        {salaryData && (
          <div style={{ animation: 'fadeUp 0.3s ease both' }}>
            {/* Trainer info bar */}
            <div style={{ background: 'var(--bg-body)', borderRadius: 10, padding: 14, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{salaryData.trainer.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>Standard: {salaryData.trainer.hourlyRate} SEK/h</span>
                {salaryData.trainer.monthlySalary && <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8 }}>(Fast lön: {salaryData.trainer.monthlySalary.toLocaleString()} SEK/mån)</span>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#6366f1' }}>{salaryData.totalPay.toLocaleString()} SEK</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{salaryData.totalHours}h, {salaryData.reportCount} rapporter</div>
              </div>
            </div>

            {/* Category rate cards */}
            {salaryData.trainer.rates && Object.keys(salaryData.trainer.rates).length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                {Object.entries(salaryData.trainer.rates as Record<string, number>).map(([cat, rate]) => (
                  <div key={cat} style={{ padding: '6px 14px', borderRadius: 8, background: `${catColors[cat] || '#64748b'}10`, border: `1px solid ${catColors[cat] || '#64748b'}30`, fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: catColors[cat] || '#64748b' }}>{catLabels[cat] || cat}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>{rate} SEK/h</span>
                  </div>
                ))}
              </div>
            )}

            {/* Breakdown per category */}
            <div className="table-wrap">
              <table>
                <thead><tr><th>Kategori</th><th>Timmar</th><th>Timlön</th><th>Rapporter</th><th>Totalt</th></tr></thead>
                <tbody>
                  {salaryData.breakdown?.map((b: any) => (
                    <tr key={b.category}>
                      <td><span style={{ fontWeight: 600, color: catColors[b.category] || '#64748b' }}>{catLabels[b.category] || b.category}</span></td>
                      <td style={{ fontWeight: 600 }}>{b.hours}h</td>
                      <td>{b.rate} SEK/h</td>
                      <td>{b.count}</td>
                      <td style={{ fontWeight: 700, fontSize: 15 }}>{b.pay.toLocaleString()} SEK</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--bg-body)' }}>
                    <td style={{ fontWeight: 700 }}>Totalt</td>
                    <td style={{ fontWeight: 700 }}>{salaryData.totalHours}h</td>
                    <td></td>
                    <td>{salaryData.reportCount}</td>
                    <td style={{ fontWeight: 800, fontSize: 16, color: '#6366f1' }}>{salaryData.totalPay.toLocaleString()} SEK</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {loading ? <div className="loading">Laddar...</div> : <>
        {/* Trainer summary cards */}
        <div className="stat-grid" style={{ gridTemplateColumns: `repeat(${Math.min(Object.keys(trainerSummary).length + 1, 5)}, 1fr)`, marginBottom: 24 }}>
          <div className="stat-card"><div className="label">Totalt</div><div className="value" style={{ color: '#6366f1' }}>{data?.totalHours}h</div><div className="sub">{data?.reports?.length} rapporter</div></div>
          {Object.values(trainerSummary).map((t: any, i) => (
            <div key={i} className="stat-card"><div className="label">{t.name}</div><div className="value" style={{ color: '#06b6d4' }}>{t.hours}h</div><div className="sub">{t.approved}h godkänd, {t.pending}h väntar</div></div>
          ))}
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Datum</th><th>Anställd</th><th>Timmar</th><th>Typ</th><th>Beskrivning</th><th>Status</th><th>Åtgärd</th></tr></thead>
            <tbody>
              {data?.reports?.map((r: any) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.date}</td>
                  <td>{r.user_name}</td>
                  <td style={{ fontWeight: 600 }}>{r.hours}h</td>
                  <td><span className={`badge ${r.type === 'training' ? 'badge-blue' : r.type === 'admin' ? 'badge-yellow' : 'badge-green'}`}>{({ training: 'Träning', admin: 'Administration', event: 'Evenemang', other: 'Övrigt' } as Record<string, string>)[r.type] ?? r.type}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{r.description || '—'}</td>
                  <td><span className={`badge ${r.approved ? 'badge-green' : 'badge-yellow'}`}>{r.approved ? 'Godkänd' : 'Väntar'}</span></td>
                  <td>{!r.approved && <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => approve(r.id)}>Godkänn</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.7px' }}>{label}</label>{children}</div>; }
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'inherit' };

