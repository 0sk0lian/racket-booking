'use client';
import { useEffect, useState, useCallback } from 'react';

const API = 'http://localhost:3001/api';
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);

interface BookingSlot {
  id: string; startHour: number; endHour: number; status: string; bookingType: string;
  bookerName: string; bookerId: string; totalPrice: number; accessPin: string;
  trainerId: string | null; trainerName: string | null;
  playerIds: string[]; playerNames: string[];
  contractId: string | null; recurrenceDay: number | null;
  eventName: string | null; eventMaxParticipants: number | null;
  attendeeCount: number; eventAttendeeIds: string[];
  notes: string | null; isSplitPayment: boolean;
}
interface CourtSchedule { courtId: string; courtName: string; sportType: string; baseRate: number; bookings: BookingSlot[]; }
interface Club { id: string; name: string; }
interface User { id: string; full_name: string; }
interface Trainer { id: string; full_name: string; sport_types: string[]; hourly_rate: number; }
type CellKey = `${string}_${number}`;
type BType = 'regular' | 'training' | 'contract' | 'event';

const TYPE_CONFIG: Record<BType, { bg: string; border: string; text: string; label: string; icon: string }> = {
  regular:  { bg: '#ecfdf5', border: '#10b981', text: '#059669', label: 'Booking',  icon: 'B' },
  training: { bg: '#eef2ff', border: '#6366f1', text: '#4f46e5', label: 'Training', icon: 'T' },
  contract: { bg: '#fef3c7', border: '#f59e0b', text: '#b45309', label: 'Contract', icon: 'C' },
  event:    { bg: '#fce7f3', border: '#ec4899', text: '#be185d', label: 'Event',    icon: 'E' },
};

export default function SchedulePage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [courts, setCourts] = useState<CourtSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<CellKey>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);

  // Create form
  const [bType, setBType] = useState<BType>('regular');
  const [bBooker, setBBooker] = useState('');
  const [bTrainer, setBTrainer] = useState('');
  const [bPlayers, setBPlayers] = useState<string[]>([]);
  const [bNotes, setBNotes] = useState('');
  const [bEventName, setBEventName] = useState('');
  const [bEventMax, setBEventMax] = useState('8');
  const [bRepeatWeeks, setBRepeatWeeks] = useState('4');

  // Edit modal
  const [edit, setEdit] = useState<(BookingSlot & { courtName: string; courtId: string }) | null>(null);
  const [eStatus, setEStatus] = useState('');
  const [eType, setEType] = useState<BType>('regular');
  const [eTrainer, setETrainer] = useState('');
  const [eBooker, setEBooker] = useState('');
  const [ePlayers, setEPlayers] = useState<string[]>([]);
  const [eNotes, setENotes] = useState('');
  const [eEventName, setEEventName] = useState('');
  const [eEventMax, setEEventMax] = useState('');
  const [eAttendees, setEAttendees] = useState<string[]>([]);
  const [eSaving, setESaving] = useState(false);

  useEffect(() => {
    Promise.all([fetch(`${API}/clubs`).then(r => r.json()), fetch(`${API}/users`).then(r => r.json())])
      .then(([c, u]) => { setClubs(c.data || []); setUsers(u.data || []); if (c.data?.length) setSelectedClub(c.data[0].id); });
  }, []);

  useEffect(() => { if (selectedClub) fetch(`${API}/admin/trainers?clubId=${selectedClub}`).then(r => r.json()).then(r => setTrainers(r.data || [])); }, [selectedClub]);

  const loadSchedule = useCallback(async () => {
    if (!selectedClub) return; setLoading(true);
    const res = await fetch(`${API}/admin/schedule?clubId=${selectedClub}&date=${date}`).then(r => r.json());
    setCourts(res.data?.courts || []); setSelected(new Set()); setLoading(false);
  }, [selectedClub, date]);
  useEffect(() => { loadSchedule(); }, [loadSchedule]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };
  const getBooking = (cid: string, h: number) => courts.find(c => c.courtId === cid)?.bookings.find(b => h >= b.startHour && h < b.endHour);

  // Drag handlers
  const onDown = (k: CellKey, cid: string, h: number) => { if (getBooking(cid, h)) return; setIsDragging(true); const s = new Set(selected); if (s.has(k)) { s.delete(k); setDragMode('deselect'); } else { s.add(k); setDragMode('select'); } setSelected(s); };
  const onEnter = (k: CellKey, cid: string, h: number) => { if (!isDragging || getBooking(cid, h)) return; const s = new Set(selected); dragMode === 'select' ? s.add(k) : s.delete(k); setSelected(s); };
  useEffect(() => { const up = () => setIsDragging(false); window.addEventListener('mouseup', up); return () => window.removeEventListener('mouseup', up); }, []);

  const getSlots = () => {
    const ch: Record<string, number[]> = {};
    selected.forEach(k => { const [c, h] = k.split('_'); if (!ch[c]) ch[c] = []; ch[c].push(Number(h)); });
    const slots: { courtId: string; startTime: string; endTime: string; courtName: string; hours: number }[] = [];
    for (const [cid, hrs] of Object.entries(ch)) {
      hrs.sort((a, b) => a - b); let s = hrs[0], e = hrs[0];
      for (let i = 1; i <= hrs.length; i++) {
        if (i < hrs.length && hrs[i] === e + 1) e = hrs[i]; else {
          slots.push({ courtId: cid, startTime: `${date}T${String(s).padStart(2, '0')}:00:00`, endTime: `${date}T${String(e + 1).padStart(2, '0')}:00:00`, courtName: courts.find(c => c.courtId === cid)?.courtName || '?', hours: e - s + 1 });
          if (i < hrs.length) { s = hrs[i]; e = hrs[i]; }
        }
      }
    } return slots;
  };

  const handleCreate = async () => {
    const slots = getSlots(); if (!slots.length) return; setSaving(true);
    const body: any = { slots: slots.map(s => ({ courtId: s.courtId, startTime: s.startTime, endTime: s.endTime })), bookingType: bType, bookerId: bBooker || undefined, notes: bNotes || undefined };
    if (bType === 'training') { body.trainerId = bTrainer; body.playerIds = bPlayers; }
    if (bType === 'contract') { body.repeatWeeks = Number(bRepeatWeeks) || 4; }
    if (bType === 'event') { body.eventName = bEventName; body.eventMaxParticipants = Number(bEventMax) || 8; }
    const res = await fetch(`${API}/admin/bookings/bulk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
    if (res.success) { flash(`Created ${res.data.created} booking(s)` + (res.data.failed ? ` — ${res.data.failed} conflicts` : '')); setBNotes(''); setBEventName(''); setBPlayers([]); await loadSchedule(); }
    setSaving(false);
  };

  // Edit
  const openEdit = (b: BookingSlot, cn: string, cid: string) => {
    setEdit({ ...b, courtName: cn, courtId: cid }); setEStatus(b.status); setEType(b.bookingType as BType);
    setETrainer(b.trainerId || ''); setEBooker(b.bookerId); setENotes(b.notes || '');
    setEPlayers(b.playerIds || []); setEEventName(b.eventName || ''); setEEventMax(String(b.eventMaxParticipants || ''));
    setEAttendees(b.eventAttendeeIds || []);
  };
  const handleEditSave = async () => {
    if (!edit) return; setESaving(true);
    const body: any = { status: eStatus, bookingType: eType, bookerId: eBooker, notes: eNotes };
    if (eType === 'training') { body.trainerId = eTrainer; body.playerIds = ePlayers; }
    if (eType === 'event') { body.eventName = eEventName; body.eventMaxParticipants = Number(eEventMax) || null; body.eventAttendeeIds = eAttendees; }
    await fetch(`${API}/admin/bookings/${edit.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    flash('Booking updated'); setEdit(null); setESaving(false); await loadSchedule();
  };
  const handleEditDelete = async () => { if (!edit || !confirm('Cancel this booking?')) return; setESaving(true); await fetch(`${API}/admin/bookings/${edit.id}`, { method: 'DELETE' }); flash('Booking cancelled'); setEdit(null); setESaving(false); await loadSchedule(); };

  const togglePlayer = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  const pendingSlots = getSlots();

  return (
    <div>
      <div className="page-header"><h1>Schedule</h1></div>
      {toast && <div className="toast">{toast}</div>}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <F label="Club"><select value={selectedClub} onChange={e => setSelectedClub(e.target.value)} style={inp}>{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></F>
        <F label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} /></F>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-outline" style={btnS} onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().split('T')[0]); }}>&larr;</button>
          <button className="btn btn-outline" style={btnS} onClick={() => setDate(new Date().toISOString().split('T')[0])}>Today</button>
          <button className="btn btn-outline" style={btnS} onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().split('T')[0]); }}>&rarr;</button>
        </div>
      </div>

      {loading ? <div className="loading">Loading...</div> : courts.length === 0 ? <div className="empty-state">No courts found.</div> : (<>
        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
          <span><Dot c="#fff" b="var(--border)" /> Available</span>
          <span><Dot c="#c7d2fe" b="#a5b4fc" /> Selected</span>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => <span key={k}><Dot c={v.bg} b={v.border} /> {v.label}</span>)}
        </div>

        {/* Grid */}
        <div style={{ overflowX: 'auto', marginBottom: 24, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: `150px repeat(${HOURS.length}, 1fr)`, minWidth: HOURS.length * 68 + 150, userSelect: 'none' }}>
            <div style={hdr} />
            {HOURS.map(h => <div key={h} style={hdr}>{String(h).padStart(2, '0')}:00</div>)}
            {courts.map(court => (<div key={court.courtId} style={{ display: 'contents' }}>
              <div style={cLbl}><div style={{ fontWeight: 600, fontSize: 13 }}>{court.courtName}</div><div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'capitalize' as const }}>{court.sportType} &middot; {court.baseRate} SEK/h</div></div>
              {HOURS.map(h => {
                const k: CellKey = `${court.courtId}_${h}`;
                const bk = getBooking(court.courtId, h);
                const sel = selected.has(k);
                if (bk) {
                  const tc = TYPE_CONFIG[bk.bookingType as BType] || TYPE_CONFIG.regular;
                  const isStart = bk.startHour === h;
                  let label2 = '';
                  if (bk.bookingType === 'training' && bk.trainerName) label2 = bk.trainerName;
                  else if (bk.bookingType === 'event' && bk.eventName) label2 = `${bk.attendeeCount}/${bk.eventMaxParticipants || '?'}`;
                  else if (bk.bookingType === 'contract') label2 = 'Weekly';
                  return (
                    <div key={k} onClick={() => openEdit(bk, court.courtName, court.courtId)} style={{ ...cell, background: tc.bg, cursor: 'pointer', borderLeft: isStart ? `3px solid ${tc.border}` : `1px solid ${tc.bg}` }}>
                      {isStart && <div style={{ overflow: 'hidden', lineHeight: 1.3 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: tc.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bk.bookingType === 'event' ? bk.eventName : bk.bookerName}</div>
                        {label2 && <div style={{ fontSize: 9.5, fontWeight: 600, color: tc.text, opacity: 0.65, textTransform: 'uppercase' as const, letterSpacing: '0.3px', marginTop: 1 }}>{label2}</div>}
                      </div>}
                    </div>
                  );
                }
                return (<div key={k} style={{ ...cell, cursor: 'crosshair', background: sel ? '#eef2ff' : '#fff', borderColor: sel ? '#a5b4fc' : 'var(--border)', boxShadow: sel ? 'inset 0 0 0 1px rgba(99,102,241,0.2)' : 'none' }} onMouseDown={() => onDown(k, court.courtId, h)} onMouseEnter={() => onEnter(k, court.courtId, h)} />);
              })}
            </div>))}
          </div>
        </div>

        {/* ─── Create Panel ─── */}
        {pendingSlots.length > 0 && (
          <div className="form-card" style={{ borderColor: TYPE_CONFIG[bType].border, animation: 'fadeUp 0.3s ease both' }}>
            {/* Type tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['regular', 'training', 'contract', 'event'] as BType[]).map(t => {
                const tc = TYPE_CONFIG[t]; const active = bType === t;
                return <button key={t} onClick={() => setBType(t)} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${active ? tc.border : 'var(--border)'}`, background: active ? tc.bg : 'var(--bg-body)', color: active ? tc.text : 'var(--text-muted)', transition: 'all 0.2s', fontFamily: 'inherit' }}>{tc.label}</button>;
              })}
            </div>

            {/* Common fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
              {bType !== 'event' && <F label="Player"><select value={bBooker} onChange={e => setBBooker(e.target.value)} style={inp}><option value="">— Admin —</option>{users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></F>}
              <F label="Notes"><input value={bNotes} onChange={e => setBNotes(e.target.value)} style={inp} placeholder="Optional..." /></F>

              {/* Training fields */}
              {bType === 'training' && <>
                <F label="Trainer"><select value={bTrainer} onChange={e => setBTrainer(e.target.value)} style={{ ...inp, borderColor: bTrainer ? TYPE_CONFIG.training.border : undefined }}><option value="">Select trainer...</option>{trainers.map(t => <option key={t.id} value={t.id}>{t.full_name} ({t.hourly_rate} SEK/h)</option>)}</select></F>
              </>}

              {/* Contract fields */}
              {bType === 'contract' && <F label="Repeat for (weeks)"><input type="number" min="1" max="52" value={bRepeatWeeks} onChange={e => setBRepeatWeeks(e.target.value)} style={inp} /></F>}

              {/* Event fields */}
              {bType === 'event' && <>
                <F label="Event Name"><input value={bEventName} onChange={e => setBEventName(e.target.value)} style={inp} placeholder="e.g. Friday Social Padel" required /></F>
                <F label="Max Participants"><input type="number" min="2" max="64" value={bEventMax} onChange={e => setBEventMax(e.target.value)} style={inp} /></F>
              </>}
            </div>

            {/* Training: assign players */}
            {bType === 'training' && (
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Assign Players to Training</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{users.map(u => {
                  const on = bPlayers.includes(u.id);
                  return <button key={u.id} type="button" onClick={() => togglePlayer(bPlayers, setBPlayers, u.id)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${on ? TYPE_CONFIG.training.border : 'var(--border)'}`, background: on ? TYPE_CONFIG.training.bg : 'var(--bg-body)', color: on ? TYPE_CONFIG.training.text : 'var(--text-muted)', transition: 'all 0.15s', fontFamily: 'inherit' }}>{u.full_name}{on && ' ✓'}</button>;
                })}</div>
              </div>
            )}

            {/* Slots summary */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
              {pendingSlots.map((s, i) => (
                <div key={i} style={{ background: 'var(--bg-body)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{s.courtName}</span><span style={{ color: 'var(--text-dim)', margin: '0 6px' }}>|</span>
                  {s.startTime.split('T')[1].substring(0, 5)} — {s.endTime.split('T')[1].substring(0, 5)}<span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>({s.hours}h)</span>
                  {bType === 'contract' && <span style={{ color: TYPE_CONFIG.contract.text, marginLeft: 6, fontSize: 11 }}>× {bRepeatWeeks} weeks</span>}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving} style={{ padding: '10px 28px' }}>{saving ? 'Creating...' : `Create ${TYPE_CONFIG[bType].label}`}</button>
              <button className="btn btn-outline" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          </div>
        )}
      </>)}

      {/* ─── Edit Modal ─── */}
      {edit && (
        <div style={overlay} onClick={() => setEdit(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: TYPE_CONFIG[edit.bookingType as BType]?.bg, color: TYPE_CONFIG[edit.bookingType as BType]?.text, fontWeight: 700, fontSize: 14 }}>{TYPE_CONFIG[edit.bookingType as BType]?.icon}</span>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>Edit {TYPE_CONFIG[edit.bookingType as BType]?.label}</h2>
              </div>
              <button onClick={() => setEdit(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px' }}>&times;</button>
            </div>

            {/* Info bar */}
            <div style={{ background: 'var(--bg-body)', borderRadius: 10, padding: 14, marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              <Info l="Court" v={edit.courtName} /><Info l="Time" v={`${edit.startHour}:00 — ${edit.endHour}:00`} /><Info l="Price" v={`${edit.totalPrice.toFixed(0)} SEK`} /><Info l="PIN" v={edit.accessPin || '—'} mono />
            </div>

            {/* Type tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              {(['regular', 'training', 'contract', 'event'] as BType[]).map(t => {
                const tc = TYPE_CONFIG[t]; const on = eType === t;
                return <button key={t} onClick={() => setEType(t)} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${on ? tc.border : 'var(--border)'}`, background: on ? tc.bg : 'transparent', color: on ? tc.text : 'var(--text-dim)', transition: 'all 0.15s', fontFamily: 'inherit' }}>{tc.label}</button>;
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <F label="Status"><select value={eStatus} onChange={e => setEStatus(e.target.value)} style={inp}><option value="confirmed">Confirmed</option><option value="pending">Pending</option><option value="cancelled">Cancelled</option></select></F>
              {eType !== 'event' && <F label="Player"><select value={eBooker} onChange={e => setEBooker(e.target.value)} style={inp}><option value="admin">Admin</option>{users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select></F>}
              {eType === 'training' && <F label="Trainer"><select value={eTrainer} onChange={e => setETrainer(e.target.value)} style={inp}><option value="">No trainer</option>{trainers.map(t => <option key={t.id} value={t.id}>{t.full_name} ({t.hourly_rate} SEK/h)</option>)}</select></F>}
              {eType === 'event' && <><F label="Event Name"><input value={eEventName} onChange={e => setEEventName(e.target.value)} style={inp} /></F><F label="Max Participants"><input type="number" value={eEventMax} onChange={e => setEEventMax(e.target.value)} style={inp} /></F></>}
            </div>

            {/* Training: player assignment */}
            {eType === 'training' && (
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Assigned Players</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{users.map(u => {
                  const on = ePlayers.includes(u.id);
                  return <button key={u.id} type="button" onClick={() => togglePlayer(ePlayers, setEPlayers, u.id)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${on ? TYPE_CONFIG.training.border : 'var(--border)'}`, background: on ? TYPE_CONFIG.training.bg : 'var(--bg-body)', color: on ? TYPE_CONFIG.training.text : 'var(--text-muted)', transition: 'all 0.15s', fontFamily: 'inherit' }}>{u.full_name}{on && ' ✓'}</button>;
                })}</div>
              </div>
            )}

            {/* Event: attendee management */}
            {eType === 'event' && (
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Attendees ({eAttendees.length}{eEventMax ? `/${eEventMax}` : ''})</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{users.map(u => {
                  const on = eAttendees.includes(u.id);
                  return <button key={u.id} type="button" onClick={() => togglePlayer(eAttendees, setEAttendees, u.id)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${on ? TYPE_CONFIG.event.border : 'var(--border)'}`, background: on ? TYPE_CONFIG.event.bg : 'var(--bg-body)', color: on ? TYPE_CONFIG.event.text : 'var(--text-muted)', transition: 'all 0.15s', fontFamily: 'inherit' }}>{u.full_name}{on && ' ✓'}</button>;
                })}</div>
              </div>
            )}

            <F label="Notes"><textarea value={eNotes} onChange={e => setENotes(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' as const, fontFamily: 'inherit' }} placeholder="Notes..." /></F>

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={eSaving} style={{ flex: 1 }}>{eSaving ? 'Saving...' : 'Save Changes'}</button>
              <button className="btn btn-outline" onClick={() => setEdit(null)}>Cancel</button>
              <button onClick={handleEditDelete} disabled={eSaving} style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', transition: 'all 0.2s' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={lbl}>{label}</label>{children}</div>; }
function Info({ l, v, mono }: { l: string; v: string; mono?: boolean }) { return <div><div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', fontWeight: 600, marginBottom: 2 }}>{l}</div><div style={{ fontSize: 14, fontWeight: 600, fontFamily: mono ? 'monospace' : 'inherit' }}>{v}</div></div>; }
function Dot({ c, b }: { c: string; b: string }) { return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 4, marginRight: 6, verticalAlign: 'middle', background: c, border: `1px solid ${b}` }} />; }

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.7px' };
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, transition: 'all 0.2s', width: '100%', fontFamily: 'inherit' };
const btnS: React.CSSProperties = { padding: '9px 14px', fontSize: 13 };
const hdr: React.CSSProperties = { padding: '12px 4px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)', background: 'var(--bg-body)' };
const cLbl: React.CSSProperties = { padding: '10px 14px', display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'var(--bg-card)', position: 'sticky', left: 0, zIndex: 1, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' };
const cell: React.CSSProperties = { minHeight: 54, border: '1px solid var(--border)', padding: 5, transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'fadeIn 0.2s ease' };
const modal: React.CSSProperties = { background: 'var(--bg-card)', borderRadius: 18, padding: 32, width: 620, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '1px solid var(--border)', animation: 'fadeUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both' };
