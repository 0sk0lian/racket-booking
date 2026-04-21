'use client';
/**
 * Kurser — course catalog for the admin Träningsplanerare.
 * List, create, edit courses. Status pills, participant counts.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = '/api';
const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  draft: { bg: '#f1f5f9', color: '#475569' },
  active: { bg: '#ecfdf5', color: '#059669' },
  completed: { bg: '#eef2ff', color: '#4f46e5' },
  cancelled: { bg: '#fef2f2', color: '#dc2626' },
};
const REG_COLORS: Record<string, { bg: string; color: string }> = {
  draft: { bg: '#f1f5f9', color: '#64748b' },
  open: { bg: '#ecfdf5', color: '#059669' },
  closed: { bg: '#fef2f2', color: '#dc2626' },
  waitlist: { bg: '#fef3c7', color: '#b45309' },
};

interface Course {
  id: string; name: string; sport_type: string; category: string;
  court_name: string; trainer_name: string | null; day_of_week: number; day_name: string;
  start_hour: number; end_hour: number; term_start: string; term_end: string;
  max_participants: number | null; price_total: number | null;
  registration_status: string; visibility: string; status: string;
  registrations_approved: number; registrations_pending: number; registrations_total: number;
}
interface Club { id: string; name: string; }
interface Court { id: string; name: string; sport_type: string; }
interface User { id: string; full_name: string; role: string; }

export default function CoursesPage() {
  const [clubs, setClubs] = useState<Club[]>([]); const [clubId, setClubId] = useState('');
  const [courses, setCourses] = useState<Course[]>([]);
  const [courts, setCourts] = useState<Court[]>([]); const [trainers, setTrainers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [fName, setFName] = useState(''); const [fSport, setFSport] = useState('padel');
  const [fCategory, setFCategory] = useState('adult'); const [fCourt, setFCourt] = useState('');
  const [fTrainer, setFTrainer] = useState(''); const [fDay, setFDay] = useState(1);
  const [fStart, setFStart] = useState(9); const [fEnd, setFEnd] = useState(10);
  const [fTermStart, setFTermStart] = useState(''); const [fTermEnd, setFTermEnd] = useState('');
  const [fMax, setFMax] = useState('8'); const [fPrice, setFPrice] = useState('');
  const [fVisibility, setFVisibility] = useState('club'); const [fDesc, setFDesc] = useState('');

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  useEffect(() => {
    fetch(`${API}/clubs`).then(r => r.json()).then(r => { setClubs(r.data ?? []); if (r.data?.length) setClubId(r.data[0].id); });
  }, []);

  useEffect(() => {
    if (!clubId) return;
    Promise.all([
      fetch(`${API}/courses?clubId=${clubId}`).then(r => r.json()),
      fetch(`${API}/courts?clubId=${clubId}`).then(r => r.json()),
      fetch(`${API}/admin/trainers?clubId=${clubId}`).then(r => r.json()),
    ]).then(([c, co, tr]) => {
      setCourses(c.data ?? []); setCourts(co.data ?? []); setTrainers(tr.data ?? []);
      setLoading(false);
    });
  }, [clubId]);

  const reload = () => fetch(`${API}/courses?clubId=${clubId}`).then(r => r.json()).then(r => setCourses(r.data ?? []));

  const deleteCourse = async (courseId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Ta bort denna kurs? Detta kan inte ångras.')) return;
    setSaving(true);
    const res = await fetch(`${API}/courses/${courseId}`, { method: 'DELETE' }).then(r => r.json());
    setSaving(false);
    if (res.success) { flash('Kurs borttagen'); reload(); }
    else flash(res.error ?? 'Kunde inte ta bort kurs');
  };

  const create = async () => {
    setSaving(true);
    const res = await fetch(`${API}/courses`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clubId, name: fName, description: fDesc || null, sportType: fSport, category: fCategory,
        courtId: fCourt || courts[0]?.id, trainerId: fTrainer || null,
        dayOfWeek: fDay, startHour: fStart, endHour: fEnd,
        termStart: fTermStart, termEnd: fTermEnd,
        maxParticipants: fMax ? Number(fMax) : null,
        priceTotal: fPrice ? Number(fPrice) : null,
        visibility: fVisibility, registrationStatus: 'open', status: 'draft',
      }),
    }).then(r => r.json());
    setSaving(false);
    if (res.success) { flash('Kurs skapad!'); setShowCreate(false); reload(); }
    else flash(res.error ?? 'Fel');
  };

  const active = courses.filter(c => c.status !== 'cancelled');

  return (
    <div>
      <div className="page-header">
        <h1>Kurser</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Ny kurs</button>
      </div>
      {toast && <div className="toast">{toast}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div><label style={lbl}>Klubb</label><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)', alignSelf: 'flex-end' }}>{active.length} kurser</div>
      </div>

      {loading ? <div className="loading">Laddar...</div> : active.length === 0 ? (
        <div className="empty-state"><p style={{ fontSize: 48, marginBottom: 12 }}>📚</p><h3>Inga kurser</h3><p style={{ color: 'var(--text-dim)' }}>Skapa din första kurs för att komma igång.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {active.map(c => (
            <Link key={c.id} href={`/courses/${c.id}`} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 22px', textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{c.name}</span>
                  <Pill {...STATUS_COLORS[c.status]}>{c.status}</Pill>
                  <Pill {...REG_COLORS[c.registration_status]}>Reg: {c.registration_status}</Pill>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {c.day_name} {String(c.start_hour).padStart(2, '0')}:00–{String(c.end_hour).padStart(2, '0')}:00 · {c.court_name}
                  {c.trainer_name && ` · ${c.trainer_name}`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
                  {c.term_start} → {c.term_end} · {c.sport_type} · {c.category}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{c.registrations_approved}<span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>/{c.max_participants ?? '∞'}</span></div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>deltagare</div>
                  {c.registrations_pending > 0 && <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginTop: 2 }}>{c.registrations_pending} väntar</div>}
                  {c.price_total && <div style={{ fontSize: 13, fontWeight: 600, color: '#6366f1', marginTop: 4 }}>{c.price_total} SEK</div>}
                </div>
                <button onClick={(e) => deleteCourse(c.id, e)} disabled={saving} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Ta bort</button>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div style={ov} onClick={() => setShowCreate(false)}><div style={md} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Ny kurs</h2>
            <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <F label="Namn"><input value={fName} onChange={e => setFName(e.target.value)} style={inp} placeholder="Nybörjare Padel — Vår 2026" /></F>
            <F label="Sport"><select value={fSport} onChange={e => setFSport(e.target.value)} style={inp}><option value="padel">Padel</option><option value="tennis">Tennis</option><option value="squash">Squash</option><option value="badminton">Badminton</option></select></F>
            <F label="Kategori"><select value={fCategory} onChange={e => setFCategory(e.target.value)} style={inp}><option value="junior">Junior</option><option value="adult">Vuxen</option><option value="senior">Senior</option><option value="camp">Läger</option><option value="competition">Tävling</option></select></F>
            <F label="Bana"><select value={fCourt} onChange={e => setFCourt(e.target.value)} style={inp}><option value="">Välj...</option>{courts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></F>
            <F label="Tränare"><select value={fTrainer} onChange={e => setFTrainer(e.target.value)} style={inp}><option value="">Välj...</option>{trainers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select></F>
            <F label="Dag"><select value={fDay} onChange={e => setFDay(Number(e.target.value))} style={inp}>{[1,2,3,4,5,6,0].map(d => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}</select></F>
            <F label="Start"><select value={fStart} onChange={e => setFStart(Number(e.target.value))} style={inp}>{Array.from({length:15},(_,i)=>i+7).map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}</select></F>
            <F label="Slut"><select value={fEnd} onChange={e => setFEnd(Number(e.target.value))} style={inp}>{Array.from({length:15},(_,i)=>i+8).filter(h=>h>fStart).map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}:00</option>)}</select></F>
            <F label="Terminsstart"><input type="date" value={fTermStart} onChange={e => setFTermStart(e.target.value)} style={inp} /></F>
            <F label="Terminsslut"><input type="date" value={fTermEnd} onChange={e => setFTermEnd(e.target.value)} style={inp} /></F>
            <F label="Max deltagare"><input type="number" value={fMax} onChange={e => setFMax(e.target.value)} style={inp} min="1" /></F>
            <F label="Pris (SEK, hela terminen)"><input type="number" value={fPrice} onChange={e => setFPrice(e.target.value)} style={inp} placeholder="0 = gratis" /></F>
            <F label="Synlighet"><select value={fVisibility} onChange={e => setFVisibility(e.target.value)} style={inp}><option value="private">Privat (bara inbjudna)</option><option value="club">Medlemmar</option><option value="public">Alla</option></select></F>
          </div>
          <F label="Beskrivning"><textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Kursbeskrivning..." /></F>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn btn-primary" onClick={create} disabled={saving || !fName || !fTermStart || !fTermEnd} style={{ flex: 1 }}>{saving ? 'Skapar...' : 'Skapa kurs'}</button>
            <button className="btn btn-outline" onClick={() => setShowCreate(false)}>Avbryt</button>
          </div>
        </div></div>
      )}
    </div>
  );
}

function Pill({ bg, color, children }: { bg: string; color: string; children: React.ReactNode }) {
  return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: bg, color, textTransform: 'capitalize' }}>{children}</span>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={lbl}>{label}</label>{children}</div>;
}
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.7px' };
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'inherit' };
const ov: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const md: React.CSSProperties = { background: 'var(--bg-card)', borderRadius: 18, padding: 28, width: 700, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '1px solid var(--border)' };
