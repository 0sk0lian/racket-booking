'use client';
import { useEffect, useState } from 'react';

const API = 'http://localhost:3001/api';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_IDX = [1, 2, 3, 4, 5, 6, 0]; // Mon=1 ... Sun=0
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7-20

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  training: { bg: '#eef2ff', border: '#6366f1', text: '#4f46e5' },
  contract: { bg: '#fef3c7', border: '#f59e0b', text: '#b45309' },
  event:    { bg: '#fce7f3', border: '#ec4899', text: '#be185d' },
};

interface Template {
  id: string; club_id: string; court_id: string; court_name: string; sport_type: string;
  day_of_week: number; day_name: string; start_hour: number; end_hour: number;
  activity_type: string; title: string; trainer_id: string | null; trainer_name: string | null;
  trainer_rate: number | null; player_ids: string[]; players: { id: string; full_name: string }[];
  event_max_participants: number | null; notes: string | null; is_active: boolean; color: string;
}
interface Court { id: string; name: string; sport_type: string; }
interface Trainer { id: string; full_name: string; hourly_rate: number; sport_types: string[]; }
interface User { id: string; full_name: string; }
interface Club { id: string; name: string; }

export default function TrainerSchedulingPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  // Create/edit modal
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editId, setEditId] = useState('');
  const [fCourt, setFCourt] = useState('');
  const [fDay, setFDay] = useState(1);
  const [fStart, setFStart] = useState(9);
  const [fEnd, setFEnd] = useState(10);
  const [fType, setFType] = useState<'training' | 'contract' | 'event'>('training');
  const [fTitle, setFTitle] = useState('');
  const [fTrainer, setFTrainer] = useState('');
  const [fPlayers, setFPlayers] = useState<string[]>([]);
  const [fEventMax, setFEventMax] = useState('8');
  const [fNotes, setFNotes] = useState('');
  const [fColor, setFColor] = useState('#6366f1');
  const [fSaving, setFSaving] = useState(false);

  // Publish modal
  const [showPublish, setShowPublish] = useState(false);
  const [pubWeeks, setPubWeeks] = useState('4');
  const [pubStart, setPubStart] = useState(() => { const d = new Date(); const diff = (1 - d.getDay() + 7) % 7; d.setDate(d.getDate() + diff); return d.toISOString().split('T')[0]; });
  const [publishing, setPublishing] = useState(false);
  const [pubResult, setPubResult] = useState<any>(null);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  useEffect(() => {
    Promise.all([fetch(`${API}/clubs`).then(r => r.json()), fetch(`${API}/users`).then(r => r.json())])
      .then(([c, u]) => { setClubs(c.data || []); setUsers(u.data || []); if (c.data?.length) setSelectedClub(c.data[0].id); });
  }, []);

  useEffect(() => {
    if (!selectedClub) return;
    setLoading(true);
    Promise.all([
      fetch(`${API}/admin/weekly?clubId=${selectedClub}`).then(r => r.json()),
      fetch(`${API}/courts?clubId=${selectedClub}`).then(r => r.json()),
      fetch(`${API}/admin/trainers?clubId=${selectedClub}`).then(r => r.json()),
    ]).then(([w, c, t]) => { setTemplates(w.data || []); setCourts(c.data || []); setTrainers(t.data || []); setLoading(false); });
  }, [selectedClub]);

  const reload = async () => {
    const r = await fetch(`${API}/admin/weekly?clubId=${selectedClub}`).then(r => r.json());
    setTemplates(r.data || []);
  };

  const openCreate = (day?: number, hour?: number, courtId?: string) => {
    setModal('create'); setEditId('');
    setFCourt(courtId || courts[0]?.id || ''); setFDay(day ?? 1); setFStart(hour ?? 9); setFEnd((hour ?? 9) + 1);
    setFType('training'); setFTitle(''); setFTrainer(''); setFPlayers([]); setFEventMax('8'); setFNotes(''); setFColor('#6366f1');
  };

  const openEdit = (t: Template) => {
    setModal('edit'); setEditId(t.id);
    setFCourt(t.court_id); setFDay(t.day_of_week); setFStart(t.start_hour); setFEnd(t.end_hour);
    setFType(t.activity_type as any); setFTitle(t.title); setFTrainer(t.trainer_id || '');
    setFPlayers(t.player_ids || []); setFEventMax(String(t.event_max_participants || '8'));
    setFNotes(t.notes || ''); setFColor(t.color);
  };

  const handleSave = async () => {
    setFSaving(true);
    const body: any = { clubId: selectedClub, courtId: fCourt, dayOfWeek: fDay, startHour: fStart, endHour: fEnd, activityType: fType, title: fTitle, color: fColor, notes: fNotes };
    if (fType === 'training') { body.trainerId = fTrainer; body.playerIds = fPlayers; }
    if (fType === 'event') { body.eventMaxParticipants = Number(fEventMax); }
    if (fType === 'contract') { body.playerIds = fPlayers; }

    const url = modal === 'edit' ? `${API}/admin/weekly/${editId}` : `${API}/admin/weekly`;
    const method = modal === 'edit' ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    if (res.success) { flash(modal === 'edit' ? 'Template updated' : 'Template created'); setModal(null); await reload(); }
    else flash('Error: ' + res.error);
    setFSaving(false);
  };

  const handleDelete = async () => {
    if (!editId || !confirm('Remove this weekly activity?')) return;
    await fetch(`${API}/admin/weekly/${editId}`, { method: 'DELETE' });
    flash('Template removed'); setModal(null); await reload();
  };

  const handlePublish = async () => {
    setPublishing(true);
    const res = await fetch(`${API}/admin/weekly/publish`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId: selectedClub, startDate: pubStart, weeks: Number(pubWeeks) }),
    }).then(r => r.json());
    setPubResult(res.data);
    setPublishing(false);
  };

  const togglePlayer = (id: string) => setFPlayers(fPlayers.includes(id) ? fPlayers.filter(x => x !== id) : [...fPlayers, id]);

  const activeTemplates = templates.filter(t => t.is_active);

  const PALETTE = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#ef4444', '#64748b'];

  return (
    <div>
      <div className="page-header">
        <h1>Trainer Scheduling</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => setShowPublish(true)}>Publish to Schedule</button>
          <button className="btn btn-primary" onClick={() => openCreate()}>+ New Activity</button>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
        <Fld label="Club"><select value={selectedClub} onChange={e => setSelectedClub(e.target.value)} style={inp}>{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
        <Fld label="View">
          <div style={{ display: 'flex', gap: 4 }}>
            <button className={`btn ${view === 'grid' ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '8px 14px', fontSize: 12 }} onClick={() => setView('grid')}>Week Grid</button>
            <button className={`btn ${view === 'list' ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '8px 14px', fontSize: 12 }} onClick={() => setView('list')}>List View</button>
          </div>
        </Fld>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', alignItems: 'center' }}>
          <span>{activeTemplates.length} active activities</span>
          <span>&middot;</span>
          <span>{trainers.length} trainers</span>
          <span>&middot;</span>
          <span>{courts.length} courts</span>
        </div>
      </div>

      {loading ? <div className="loading">Loading...</div> : view === 'grid' ? (
        /* ─── Week Grid View (absolute positioned blocks) ─── */
        <div style={{ overflowX: 'auto' }}>
          {courts.map(court => {
            const courtTemplates = activeTemplates.filter(t => t.court_id === court.id);
            const ROW_H = 40; // px per hour row
            const COL_W_PCT = 100 / 7; // % per day column
            const FIRST_HOUR = HOURS[0]; // 7
            const TOTAL_ROWS = HOURS.length;

            return (
              <div key={court.id} style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{court.name}</span>
                  <span className={`badge ${court.sport_type === 'padel' ? 'badge-blue' : 'badge-green'}`} style={{ fontSize: 10 }}>{court.sport_type}</span>
                </h3>
                <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
                  {/* Day headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
                    <div style={hdr} />
                    {DAYS.map(d => <div key={d} style={{ ...hdr, fontWeight: 700 }}>{d.substring(0, 3)}</div>)}
                  </div>

                  {/* Body: time labels on left + relative container for day columns */}
                  <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr' }}>
                    {/* Time labels */}
                    <div>
                      {HOURS.map(h => (
                        <div key={h} style={{ height: ROW_H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 600, color: 'var(--text-dim)', borderBottom: '1px solid #f1f5f9', borderRight: '1px solid var(--border)' }}>
                          {String(h).padStart(2, '0')}:00
                        </div>
                      ))}
                    </div>

                    {/* Day columns with absolute positioned blocks */}
                    <div style={{ position: 'relative', height: TOTAL_ROWS * ROW_H }}>
                      {/* Grid lines */}
                      {HOURS.map((h, i) => (
                        <div key={h} style={{ position: 'absolute', top: i * ROW_H, left: 0, right: 0, height: ROW_H, borderBottom: '1px solid #f1f5f9' }} />
                      ))}
                      {DAY_IDX.map((_, di) => (
                        <div key={di} style={{ position: 'absolute', top: 0, bottom: 0, left: `${di * COL_W_PCT}%`, width: '1px', background: '#f1f5f9' }} />
                      ))}

                      {/* Clickable empty cells */}
                      {HOURS.map(h => DAY_IDX.map((dayNum, di) => (
                        <div key={`${h}_${di}`}
                          onClick={() => openCreate(dayNum, h, court.id)}
                          style={{ position: 'absolute', top: (h - FIRST_HOUR) * ROW_H, left: `${di * COL_W_PCT}%`, width: `${COL_W_PCT}%`, height: ROW_H, cursor: 'pointer', zIndex: 0 }}
                        />
                      )))}

                      {/* Template blocks */}
                      {courtTemplates.map(tmpl => {
                        const tc = TYPE_COLORS[tmpl.activity_type] || TYPE_COLORS.training;
                        const dayCol = DAY_IDX.indexOf(tmpl.day_of_week);
                        if (dayCol === -1) return null;
                        const top = (tmpl.start_hour - FIRST_HOUR) * ROW_H;
                        const height = (tmpl.end_hour - tmpl.start_hour) * ROW_H;

                        return (
                          <div key={tmpl.id} onClick={() => openEdit(tmpl)} style={{
                            position: 'absolute', top, left: `calc(${dayCol * COL_W_PCT}% + 2px)`,
                            width: `calc(${COL_W_PCT}% - 4px)`, height: height - 2,
                            background: tc.bg, borderLeft: `3px solid ${tmpl.color || tc.border}`,
                            borderRadius: 6, padding: '5px 8px', cursor: 'pointer', zIndex: 1,
                            overflow: 'hidden', transition: 'box-shadow 0.2s, transform 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                          }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 700, color: tc.text, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tmpl.title}</div>
                            {height > 42 && tmpl.trainer_name && <div style={{ fontSize: 9.5, color: tc.text, opacity: 0.7, marginTop: 2 }}>{tmpl.trainer_name}</div>}
                            {height > 56 && tmpl.activity_type === 'event' && <div style={{ fontSize: 9.5, color: tc.text, opacity: 0.6 }}>Max {tmpl.event_max_participants}</div>}
                            {height > 70 && tmpl.players.length > 0 && <div style={{ fontSize: 9, color: tc.text, opacity: 0.5, marginTop: 1 }}>{tmpl.players.map(p => p.full_name.split(' ')[0]).join(', ')}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ─── List View ─── */
        <div className="table-wrap">
          <table>
            <thead><tr><th>Day</th><th>Time</th><th>Court</th><th>Type</th><th>Title</th><th>Trainer</th><th>Players</th><th>Actions</th></tr></thead>
            <tbody>
              {activeTemplates.sort((a, b) => a.day_of_week - b.day_of_week || a.start_hour - b.start_hour).map(t => {
                const tc = TYPE_COLORS[t.activity_type] || TYPE_COLORS.training;
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.day_name?.substring(0, 3)}</td>
                    <td>{String(t.start_hour).padStart(2, '0')}:00 — {String(t.end_hour).padStart(2, '0')}:00</td>
                    <td>{t.court_name}</td>
                    <td><span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}>{t.activity_type}</span></td>
                    <td style={{ fontWeight: 600 }}>{t.title}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{t.trainer_name || '—'}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t.players?.map(p => p.full_name.split(' ')[0]).join(', ') || '—'}</td>
                    <td><button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => openEdit(t)}>Edit</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Create/Edit Modal ─── */}
      {modal && (
        <div style={overlay} onClick={() => setModal(null)}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{modal === 'edit' ? 'Edit' : 'New'} Weekly Activity</h2>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </div>

            {/* Type selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['training', 'contract', 'event'] as const).map(t => {
                const tc = TYPE_COLORS[t]; const on = fType === t;
                return <button key={t} onClick={() => setFType(t)} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${on ? tc.border : 'var(--border)'}`, background: on ? tc.bg : 'var(--bg-body)', color: on ? tc.text : 'var(--text-muted)', transition: 'all 0.15s', fontFamily: 'inherit', textTransform: 'capitalize' }}>{t}</button>;
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <Fld label="Title"><input value={fTitle} onChange={e => setFTitle(e.target.value)} style={inp} placeholder="e.g. Beginners Padel" /></Fld>
              <Fld label="Court"><select value={fCourt} onChange={e => setFCourt(e.target.value)} style={inp}>{courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
              <Fld label="Day"><select value={fDay} onChange={e => setFDay(Number(e.target.value))} style={inp}>{DAY_IDX.map((d, i) => <option key={d} value={d}>{DAYS[i]}</option>)}</select></Fld>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Fld label="Start"><select value={fStart} onChange={e => { const v = Number(e.target.value); setFStart(v); if (fEnd <= v) setFEnd(v + 1); }} style={inp}>{HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select></Fld>
                <Fld label="End"><select value={fEnd} onChange={e => setFEnd(Number(e.target.value))} style={inp}>{HOURS.filter(h => h > fStart).map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}<option value={21}>21:00</option></select></Fld>
              </div>
            </div>

            {/* Type-specific fields */}
            {fType === 'training' && (
              <div style={{ marginBottom: 16 }}>
                <Fld label="Trainer"><select value={fTrainer} onChange={e => setFTrainer(e.target.value)} style={inp}><option value="">Select trainer...</option>{trainers.map(t => <option key={t.id} value={t.id}>{t.full_name} ({t.hourly_rate} SEK/h)</option>)}</select></Fld>
                <div style={{ marginTop: 12 }}>
                  <label style={lbl}>Assign Players</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{users.map(u => {
                    const on = fPlayers.includes(u.id);
                    return <button key={u.id} type="button" onClick={() => togglePlayer(u.id)} style={{ ...chip, borderColor: on ? '#6366f1' : 'var(--border)', background: on ? '#eef2ff' : 'var(--bg-body)', color: on ? '#4f46e5' : 'var(--text-muted)' }}>{u.full_name}{on && ' \u2713'}</button>;
                  })}</div>
                </div>
              </div>
            )}

            {fType === 'contract' && (
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Contract Holder</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{users.map(u => {
                  const on = fPlayers.includes(u.id);
                  return <button key={u.id} type="button" onClick={() => setFPlayers(on ? [] : [u.id])} style={{ ...chip, borderColor: on ? '#f59e0b' : 'var(--border)', background: on ? '#fef3c7' : 'var(--bg-body)', color: on ? '#b45309' : 'var(--text-muted)' }}>{u.full_name}{on && ' \u2713'}</button>;
                })}</div>
              </div>
            )}

            {fType === 'event' && (
              <Fld label="Max Participants"><input type="number" min="2" max="64" value={fEventMax} onChange={e => setFEventMax(e.target.value)} style={inp} /></Fld>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16, marginTop: 12 }}>
              <Fld label="Notes"><input value={fNotes} onChange={e => setFNotes(e.target.value)} style={inp} placeholder="Optional..." /></Fld>
              <Fld label="Color">
                <div style={{ display: 'flex', gap: 6 }}>{PALETTE.map(c => (
                  <button key={c} onClick={() => setFColor(c)} style={{ width: 28, height: 28, borderRadius: 8, background: c, border: fColor === c ? '2.5px solid var(--text)' : '2px solid transparent', cursor: 'pointer', transition: 'all 0.15s' }} />
                ))}</div>
              </Fld>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={fSaving} style={{ flex: 1 }}>{fSaving ? 'Saving...' : modal === 'edit' ? 'Save Changes' : 'Create Activity'}</button>
              <button className="btn btn-outline" onClick={() => setModal(null)}>Cancel</button>
              {modal === 'edit' && <button onClick={handleDelete} style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>Remove</button>}
            </div>
          </div>
        </div>
      )}

      {/* ─── Publish Modal ─── */}
      {showPublish && (
        <div style={overlay} onClick={() => { setShowPublish(false); setPubResult(null); }}>
          <div style={modalBox} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Publish Weekly Schedule</h2>
              <button onClick={() => { setShowPublish(false); setPubResult(null); }} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: 13.5, marginBottom: 20, lineHeight: 1.6 }}>
              This will generate actual bookings from all <strong>{activeTemplates.length} active weekly templates</strong> for the specified date range. Existing bookings that conflict will be skipped.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <Fld label="Start Date (Monday)"><input type="date" value={pubStart} onChange={e => setPubStart(e.target.value)} style={inp} /></Fld>
              <Fld label="Number of Weeks"><select value={pubWeeks} onChange={e => setPubWeeks(e.target.value)} style={inp}>{[1,2,3,4,6,8,12].map(w => <option key={w} value={w}>{w} week{w > 1 ? 's' : ''}</option>)}</select></Fld>
            </div>

            {/* Preview */}
            <div style={{ background: 'var(--bg-body)', borderRadius: 10, padding: 16, marginBottom: 20, maxHeight: 200, overflow: 'auto' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Templates to publish</div>
              {activeTemplates.sort((a, b) => a.day_of_week - b.day_of_week || a.start_hour - b.start_hour).map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: t.color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, minWidth: 36 }}>{t.day_name?.substring(0, 3)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{String(t.start_hour).padStart(2, '0')}:00-{String(t.end_hour).padStart(2, '0')}:00</span>
                  <span>{t.title}</span>
                  <span style={{ color: 'var(--text-dim)', marginLeft: 'auto', fontSize: 11 }}>{t.court_name}</span>
                </div>
              ))}
            </div>

            {pubResult && (
              <div style={{ background: pubResult.created > 0 ? 'var(--green-bg)' : 'var(--yellow-bg)', border: `1px solid ${pubResult.created > 0 ? 'var(--green-border)' : 'var(--yellow-border)'}`, borderRadius: 10, padding: 16, marginBottom: 16, animation: 'fadeUp 0.3s ease both' }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: pubResult.created > 0 ? 'var(--green)' : 'var(--yellow)' }}>
                  {pubResult.created} bookings created{pubResult.skipped > 0 && `, ${pubResult.skipped} skipped`}
                </div>
                {pubResult.conflicts?.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                    {pubResult.conflicts.slice(0, 5).map((c: any, i: number) => <div key={i}>{c.template}: {c.reason} {c.date && `(${c.date})`}</div>)}
                    {pubResult.conflicts.length > 5 && <div>...and {pubResult.conflicts.length - 5} more</div>}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={handlePublish} disabled={publishing} style={{ flex: 1 }}>
                {publishing ? 'Publishing...' : `Publish ${activeTemplates.length} activities for ${pubWeeks} week${Number(pubWeeks) > 1 ? 's' : ''}`}
              </button>
              <button className="btn btn-outline" onClick={() => { setShowPublish(false); setPubResult(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={lbl}>{label}</label>{children}</div>; }
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.7px' };
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, transition: 'all 0.2s', width: '100%', fontFamily: 'inherit' };
const chip: React.CSSProperties = { padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.15s', fontFamily: 'inherit' };
const hdr: React.CSSProperties = { padding: '10px 6px', fontSize: 10.5, fontWeight: 600, color: 'var(--text-dim)', textAlign: 'center', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)', background: 'var(--bg-body)' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'fadeIn 0.2s ease' };
const modalBox: React.CSSProperties = { background: 'var(--bg-card)', borderRadius: 18, padding: 32, width: 620, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '1px solid var(--border)', animation: 'fadeUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both' };
