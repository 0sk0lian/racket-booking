'use client';
import { useEffect, useState } from 'react';

const API = 'http://localhost:3001/api';
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);
const DAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
const DAY_IDX = [1, 2, 3, 4, 5, 6, 0]; // Mon=1 ... Sun=0

interface Person { id: string; name: string; }
interface Session { id: string; title: string; court_id: string; court_name: string; sport_type: string; trainer_id: string; trainer_name: string; player_ids: string[]; players: Person[]; going: Person[]; declined: Person[]; invited: Person[]; waitlist: Person[]; day_of_week: number; day_name: string; start_hour: number; end_hour: number; notes: string | null; status: string; applied_dates: string[]; }
interface Court { id: string; name: string; sport_type: string; }
interface User { id: string; full_name: string; role: string; }
interface Group { id: string; name: string; category: string; parent_group_id: string | null; parent_group_name: string | null; is_master_category: boolean; child_groups: { id: string; name: string; player_count: number }[]; player_ids: string[]; players: { id: string; full_name: string }[]; }
interface Club { id: string; name: string; }

export default function TrainingPlannerPage() {
  const [clubs, setClubs] = useState<Club[]>([]); const [clubId, setClubId] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [courts, setCourts] = useState<Court[]>([]); const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true); const [toast, setToast] = useState('');

  // Grid: which day is selected
  const [selectedDay, setSelectedDay] = useState(1); // Monday default

  // Create/edit form
  const [showForm, setShowForm] = useState(false); const [editId, setEditId] = useState('');
  const [fTitle, setFTitle] = useState(''); const [fCourt, setFCourt] = useState('');
  const [fTrainer, setFTrainer] = useState(''); const [fPlayers, setFPlayers] = useState<string[]>([]);
  const [fDay, setFDay] = useState(1); const [fStart, setFStart] = useState(9); const [fEnd, setFEnd] = useState(10);
  const [fNotes, setFNotes] = useState(''); const [saving, setSaving] = useState(false);
  const [pickerCategory, setPickerCategory] = useState(''); const [pickerGroup, setPickerGroup] = useState('');


  // Apply modal
  const [showApply, setShowApply] = useState(false);
  const [applyStart, setApplyStart] = useState(() => { const d = new Date(); const diff = (1 - d.getDay() + 7) % 7; d.setDate(d.getDate() + diff); return d.toISOString().split('T')[0]; });
  const [applyEnd, setApplyEnd] = useState(() => { const d = new Date(); const diff = (1 - d.getDay() + 7) % 7; d.setDate(d.getDate() + diff + 7 * 12); return d.toISOString().split('T')[0]; });
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<any>(null);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };
  const trainers = users.filter(u => u.role === 'trainer');
  const masterCategories = groups.filter(g => g.is_master_category);

  useEffect(() => {
    Promise.all([fetch(`${API}/clubs`).then(r => r.json()), fetch(`${API}/users`).then(r => r.json())])
      .then(([c, u]) => { setClubs(c.data || []); setUsers(u.data || []); if (c.data?.length) setClubId(c.data[0].id); });
  }, []);
  useEffect(() => { if (!clubId) return; Promise.all([fetch(`${API}/courts?clubId=${clubId}`).then(r => r.json()), fetch(`${API}/features/groups?clubId=${clubId}`).then(r => r.json())]).then(([c, g]) => { setCourts(c.data || []); setGroups(g.data || []); }); }, [clubId]);

  const reload = async () => { if (!clubId) return; setLoading(true); const r = await fetch(`${API}/training-planner?clubId=${clubId}`).then(r => r.json()); setSessions(r.data || []); setLoading(false); };
  useEffect(() => { reload(); }, [clubId]);

  const openCreate = (day?: number, hour?: number, courtId?: string) => {
    setEditId(''); setShowForm(true); setFTitle(''); setFCourt(courtId || courts[0]?.id || '');
    setFTrainer(''); setFPlayers([]); setFDay(day ?? selectedDay); setFStart(hour ?? 9); setFEnd((hour ?? 9) + 1);
    setFNotes(''); setPickerCategory(''); setPickerGroup('');
  };
  const openEdit = (s: Session) => {
    setEditId(s.id); setShowForm(true); setFTitle(s.title); setFCourt(s.court_id); setFTrainer(s.trainer_id);
    setFPlayers(s.player_ids); setFDay(s.day_of_week); setFStart(s.start_hour); setFEnd(s.end_hour);
    setFNotes(s.notes || ''); setPickerCategory(''); setPickerGroup('');
  };

  const handleSave = async () => {
    if (!fCourt || !fTrainer) return; setSaving(true);
    const body = { clubId, title: fTitle || 'Träningspass', courtId: fCourt, trainerId: fTrainer, playerIds: fPlayers, dayOfWeek: fDay, startHour: fStart, endHour: fEnd, notes: fNotes };
    const url = editId ? `${API}/training-planner/${editId}` : `${API}/training-planner`;
    await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    flash(editId ? 'Pass uppdaterat' : 'Pass skapat'); setShowForm(false); setSaving(false); await reload();
  };
  const handleDelete = async (id: string) => { if (!confirm('Ta bort detta pass?')) return; await fetch(`${API}/training-planner/${id}`, { method: 'DELETE' }); flash('Pass borttaget'); setShowForm(false); await reload(); };
  const handleApply = async () => {
    setApplying(true);
    const r = await fetch(`${API}/training-planner/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clubId, startDate: applyStart, endDate: applyEnd }) }).then(r => r.json());
    setApplyResult(r.data); setApplying(false);
    if (r.success) flash(`${r.data.created} bokningar skapade${r.data.skipped ? `, ${r.data.skipped} hoppade över` : ''}${r.data.failed ? `, ${r.data.failed} misslyckades` : ''}`);
    await reload();
  };

  const togglePlayer = (id: string) => setFPlayers(fPlayers.includes(id) ? fPlayers.filter(x => x !== id) : [...fPlayers, id]);
  const addGroupPlayers = (gid: string) => { const g = groups.find(g => g.id === gid); if (g) setFPlayers([...new Set([...fPlayers, ...g.player_ids])]); };
  const getChildGroups = (pid: string) => groups.filter(g => g.parent_group_id === pid);
  const getGroupPlayers = (gid: string) => groups.find(g => g.id === gid)?.players || [];

  const active = sessions.filter(s => s.status !== 'cancelled');
  const daySessions = active.filter(s => s.day_of_week === selectedDay);

  // Grid data
  const ROW_H = 40; const FIRST_HOUR = 7; const LAST_HOUR = 21; const TOTAL_ROWS = LAST_HOUR - FIRST_HOUR;

  return (
    <div>
      <div className="page-header">
        <h1>Träningsplanerare</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowApply(true)} style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)', boxShadow: '0 2px 12px rgba(16,185,129,0.3)' }}>Tillämpa på period</button>
          <button className="btn btn-primary" onClick={() => openCreate()}>+ Nytt pass</button>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <Fld label="Klubb"><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)', alignSelf: 'flex-end' }}>{active.length} pass planerade &middot; {courts.length} banor</div>
      </div>

      {/* Day tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {DAY_IDX.map((dow, i) => {
          const count = active.filter(s => s.day_of_week === dow).length;
          const isActive = selectedDay === dow;
          return <button key={dow} onClick={() => setSelectedDay(dow)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: isActive ? 700 : 500, cursor: 'pointer', border: `1.5px solid ${isActive ? '#6366f1' : count > 0 ? '#e2e8f0' : '#f1f5f9'}`, background: isActive ? '#eef2ff' : count > 0 ? 'var(--bg-card)' : 'var(--bg-body)', color: isActive ? '#4f46e5' : count > 0 ? 'var(--text)' : 'var(--text-dim)', transition: 'all 0.15s', fontFamily: 'inherit' }}>
            {DAYS[i]} {count > 0 && <span style={{ opacity: 0.5, marginLeft: 2 }}>({count})</span>}
          </button>;
        })}
      </div>

      {loading ? <div className="loading">Loading...</div> : (<>
        {/* ─── Day Grid: courts as columns ─── */}
        <div style={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden', marginBottom: 28 }}>
          {/* Court headers */}
          <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(${courts.length}, 1fr)`, borderBottom: '1px solid var(--border)' }}>
            <div style={gHdr}>{DAYS[DAY_IDX.indexOf(selectedDay)]?.substring(0, 3)}</div>
            {courts.map(c => <div key={c.id} style={{ ...gHdr, fontWeight: 700 }}>{c.name}<div style={{ fontSize: 9, fontWeight: 500, opacity: 0.6, textTransform: 'capitalize' as const }}>{c.sport_type}</div></div>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr' }}>
            {/* Time labels */}
            <div>
              {Array.from({ length: TOTAL_ROWS }, (_, i) => i + FIRST_HOUR).map(h => (
                <div key={h} style={{ height: ROW_H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 600, color: 'var(--text-dim)', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid var(--border)' }}>{String(h).padStart(2, '0')}:00</div>
              ))}
            </div>

            {/* Court columns */}
            <div style={{ position: 'relative', height: TOTAL_ROWS * ROW_H }}>
              {Array.from({ length: TOTAL_ROWS }, (_, i) => <div key={`h${i}`} style={{ position: 'absolute', top: i * ROW_H, left: 0, right: 0, height: ROW_H, borderBottom: '1px solid #f1f5f9' }} />)}
              {courts.map((_, i) => i > 0 && <div key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${(i / courts.length) * 100}%`, width: 1, background: '#f1f5f9' }} />)}

              {/* Clickable empty cells */}
              {Array.from({ length: TOTAL_ROWS }, (_, hi) => courts.map((court, ci) => (
                <div key={`${hi}_${ci}`} onClick={() => openCreate(selectedDay, FIRST_HOUR + hi, court.id)} style={{ position: 'absolute', top: hi * ROW_H, left: `${(ci / courts.length) * 100}%`, width: `${100 / courts.length}%`, height: ROW_H, cursor: 'pointer', zIndex: 0 }} />
              )))}

              {/* Session blocks */}
              {daySessions.map(s => {
                const ci = courts.findIndex(c => c.id === s.court_id);
                if (ci === -1) return null;
                const top = (s.start_hour - FIRST_HOUR) * ROW_H;
                const height = (s.end_hour - s.start_hour) * ROW_H;
                const isApplied = s.status === 'applied';
                const bg = isApplied ? '#d1fae5' : '#fef3c7';
                const border = isApplied ? '#10b981' : '#f59e0b';
                const text = isApplied ? '#065f46' : '#92400e';

                return (
                  <div key={s.id} onClick={() => openEdit(s)} style={{
                    position: 'absolute', top: top + 2, left: `calc(${(ci / courts.length) * 100}% + 3px)`,
                    width: `calc(${100 / courts.length}% - 6px)`, height: height - 4,
                    background: bg, borderLeft: `3px solid ${border}`, borderRadius: 8,
                    padding: '5px 8px', cursor: 'pointer', overflow: 'hidden', zIndex: 1,
                    transition: 'box-shadow 0.2s, transform 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'scale(1.02)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'scale(1)'; }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                    <div style={{ fontSize: 9.5, color: text, opacity: 0.7, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.trainer_name}</div>
                    {height > 58 && <div style={{ fontSize: 9, color: text, opacity: 0.5 }}>{s.going.length}/{s.players.length}p</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Session list below grid */}
        {daySessions.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{DAYS[DAY_IDX.indexOf(selectedDay)]}ens pass ({daySessions.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {daySessions.sort((a, b) => a.start_hour - b.start_hour).map(s => (
                <div key={s.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--shadow-xs)', transition: 'all 0.2s' }}>
                  {/* Header */}
                  <div onClick={() => openEdit(s)} style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{s.day_name}</h4>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        {String(s.start_hour).padStart(2, '0')}:{String(0).padStart(2, '0')}–{String(s.end_hour).padStart(2, '0')}:00 &nbsp;&nbsp; {s.court_name}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#4f46e5' }}>{s.trainer_name}</span>
                      <span style={{ padding: '3px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: s.status === 'applied' ? '#d1fae5' : '#fef3c7', color: s.status === 'applied' ? '#059669' : '#b45309' }}>{s.status === 'applied' ? `${s.applied_dates.length}×` : 'Ny'}</span>
                    </div>
                  </div>

                  {/* Attendance columns */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', borderTop: '1px solid var(--border)' }}>
                    <AttendanceCol label="Going" count={s.going.length} color="#059669" bg="#ecfdf5" icon="✓" names={s.going} />
                    <AttendanceCol label="No" count={s.declined.length} color="#dc2626" bg="#fef2f2" icon="✕" names={s.declined} />
                    <AttendanceCol label="Invited" count={s.invited.length} color="#6b7280" bg="#f9fafb" icon="◎" names={s.invited} />
                    <AttendanceCol label="Waitlist" count={s.waitlist.length} color="#7c3aed" bg="#f5f3ff" icon="☰" names={s.waitlist} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {active.length === 0 && <div className="empty-state"><p style={{ fontSize: 48, marginBottom: 12 }}>&#x1F3BE;</p><h3>Inga träningspass planerade</h3><p style={{ color: 'var(--text-dim)', marginTop: 4 }}>Klicka i schemat eller tryck "+ Nytt pass"</p></div>}

        {/* Salary calculation moved to Tidrapportering */}
      </>)}

      {/* ─── Create/Edit Form (modal) ─── */}
      {showForm && (
        <div style={ov} onClick={() => setShowForm(false)}><div style={md} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>{editId ? 'Redigera pass' : 'Nytt träningspass'}</h2>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <Fld label="Titel"><input value={fTitle} onChange={e => setFTitle(e.target.value)} style={inp} placeholder="t.ex. Nybörjare Padel" /></Fld>
            <Fld label="Dag"><select value={fDay} onChange={e => setFDay(Number(e.target.value))} style={inp}>{DAY_IDX.map((d, i) => <option key={d} value={d}>{DAYS[i]}</option>)}</select></Fld>
            <Fld label="Bana"><select value={fCourt} onChange={e => setFCourt(e.target.value)} style={inp}><option value="">Välj...</option>{courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
            <Fld label="Tränare"><select value={fTrainer} onChange={e => setFTrainer(e.target.value)} style={inp}><option value="">Välj...</option>{trainers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Fld>
            <Fld label="Start"><select value={fStart} onChange={e => { const v = Number(e.target.value); setFStart(v); if (fEnd <= v) setFEnd(v + 1); }} style={inp}>{HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></Fld>
            <Fld label="Slut"><select value={fEnd} onChange={e => setFEnd(Number(e.target.value))} style={inp}>{HOURS.filter(h => h > fStart).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}<option value={22}>22:00</option></select></Fld>
          </div>

          {/* Player picker */}
          <div style={{ background: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.7px', marginBottom: 8 }}>Välj spelare från grupper</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {masterCategories.map(cat => <button key={cat.id} onClick={() => { setPickerCategory(pickerCategory === cat.id ? '' : cat.id); setPickerGroup(''); }} style={{ ...chip, borderColor: pickerCategory === cat.id ? '#6366f1' : 'var(--border)', background: pickerCategory === cat.id ? '#eef2ff' : '#fff', color: pickerCategory === cat.id ? '#4f46e5' : 'var(--text-muted)' }}>{cat.name} ({cat.child_groups.length})</button>)}
              {groups.filter(g => !g.parent_group_id && !g.is_master_category && g.player_ids.length > 0).map(g => <button key={g.id} onClick={() => { setPickerCategory(''); setPickerGroup(pickerGroup === g.id ? '' : g.id); }} style={{ ...chip, borderColor: pickerGroup === g.id ? '#10b981' : 'var(--border)', background: pickerGroup === g.id ? '#ecfdf5' : '#fff', color: pickerGroup === g.id ? '#059669' : 'var(--text-muted)' }}>{g.name} ({g.player_ids.length})</button>)}
            </div>
            {pickerCategory && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>{getChildGroups(pickerCategory).map(g => <button key={g.id} onClick={() => setPickerGroup(pickerGroup === g.id ? '' : g.id)} style={{ ...chip, fontSize: 11, borderColor: pickerGroup === g.id ? '#10b981' : 'var(--border)', background: pickerGroup === g.id ? '#ecfdf5' : '#fff', color: pickerGroup === g.id ? '#059669' : 'var(--text-secondary)' }}>{g.name} ({g.player_ids.length})</button>)}</div>}
            {pickerGroup && <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)' }}>Spelare</span><button onClick={() => addGroupPlayers(pickerGroup)} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px solid #a7f3d0', background: '#ecfdf5', color: '#059669', fontFamily: 'inherit' }}>Alla</button></div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>{getGroupPlayers(pickerGroup).map((p: any) => { const on = fPlayers.includes(p.id); return <button key={p.id} onClick={() => togglePlayer(p.id)} style={{ ...chip, fontSize: 11, borderColor: on ? '#10b981' : '#e2e8f0', background: on ? '#ecfdf5' : '#fff', color: on ? '#059669' : 'var(--text-muted)' }}>{p.full_name}{on && ' \u2713'}</button>; })}</div>
            </div>}
            {fPlayers.length > 0 && <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}><span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Valda ({fPlayers.length}): </span>{fPlayers.map(id => { const u = users.find(u => u.id === id); return <span key={id} onClick={() => togglePlayer(id)} style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', cursor: 'pointer', marginRight: 4, display: 'inline-block', marginBottom: 2 }}>{u?.full_name ?? '?'} &times;</span>; })}</div>}
          </div>

          <Fld label="Anteckningar"><input value={fNotes} onChange={e => setFNotes(e.target.value)} style={inp} placeholder="Fokus, övningar..." /></Fld>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>{saving ? 'Sparar...' : editId ? 'Spara' : 'Skapa pass'}</button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Avbryt</button>
            {editId && <button onClick={() => handleDelete(editId)} style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>Ta bort</button>}
          </div>
        </div></div>
      )}

      {/* ─── Apply to Period Modal ─── */}
      {showApply && (
        <div style={ov} onClick={() => { setShowApply(false); setApplyResult(null); }}><div style={md} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Tillämpa på period</h2>
            <button onClick={() => { setShowApply(false); setApplyResult(null); }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
            Detta skapar faktiska bokningar i schemat för alla <strong>{active.length} planerade pass</strong> på varje matchande veckodag inom den valda perioden. Redan tillämpade dagar hoppas över.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
            <Fld label="Startdatum"><input type="date" value={applyStart} onChange={e => setApplyStart(e.target.value)} style={inp} /></Fld>
            <Fld label="Slutdatum"><input type="date" value={applyEnd} onChange={e => setApplyEnd(e.target.value)} style={inp} /></Fld>
          </div>

          {/* Preview */}
          <div style={{ background: 'var(--bg-body)', borderRadius: 10, padding: 14, marginBottom: 16, maxHeight: 200, overflow: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 8, textTransform: 'uppercase' as const }}>Pass som tillämpas</div>
            {DAY_IDX.map((dow, i) => {
              const ds = active.filter(s => s.day_of_week === dow);
              if (ds.length === 0) return null;
              return <div key={dow} style={{ marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 12 }}>{DAYS[i]}: </span>
                {ds.map(s => <span key={s.id} style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 8 }}>{s.title} ({String(s.start_hour).padStart(2, '0')}-{String(s.end_hour).padStart(2, '0')})</span>)}
              </div>;
            })}
          </div>

          {applyResult && (
            <div style={{ background: applyResult.created > 0 ? '#ecfdf5' : '#fef3c7', border: `1px solid ${applyResult.created > 0 ? '#a7f3d0' : '#fde68a'}`, borderRadius: 10, padding: 14, marginBottom: 16, animation: 'fadeUp 0.3s ease both' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: applyResult.created > 0 ? '#059669' : '#b45309' }}>{applyResult.created} bokningar skapade{applyResult.skipped > 0 && `, ${applyResult.skipped} hoppade över`}{applyResult.failed > 0 && `, ${applyResult.failed} misslyckades`}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={handleApply} disabled={applying} style={{ flex: 1 }}>{applying ? 'Tillämpar...' : `Tillämpa ${active.length} pass`}</button>
            <button className="btn btn-outline" onClick={() => { setShowApply(false); setApplyResult(null); }}>Stäng</button>
          </div>
        </div></div>
      )}
    </div>
  );
}

function AttendanceCol({ label, count, color, bg, icon, names }: { label: string; count: number; color: string; bg: string; icon: string; names: Person[] }) {
  return (
    <div style={{ padding: '12px 16px', borderRight: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span>{icon}</span> {label} ({count})
      </div>
      {names.length > 0 ? names.map(p => (
        <div key={p.id} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '2px 0' }}>{p.name}</div>
      )) : (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>Empty</div>
      )}
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.7px' }}>{label}</label>{children}</div>; }
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'inherit' };
const chip: React.CSSProperties = { padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1.5px solid var(--border)', transition: 'all 0.15s', fontFamily: 'inherit' };
const gHdr: React.CSSProperties = { padding: '10px 6px', fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textAlign: 'center', letterSpacing: '0.3px', background: 'var(--bg-body)' };
const ov: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const md: React.CSSProperties = { background: 'var(--bg-card)', borderRadius: 18, padding: 32, width: 620, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '1px solid var(--border)', animation: 'fadeUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both' };
