'use client';
/**
 * Course detail — admin view with tabs: Översikt | Anmälningar | Sessioner | Närvaro
 */
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API = '/api';

interface Course { id: string; name: string; description: string | null; sport_type: string; category: string; court_name: string; trainer_name: string | null; day_of_week: number; start_hour: number; end_hour: number; term_start: string; term_end: string; skip_dates: string[]; max_participants: number | null; price_total: number | null; price_per_session: number | null; registration_status: string; visibility: string; status: string; }
interface Registration { id: string; user_id: string; user_name: string; user_email: string | null; user_phone: string | null; status: string; payment_status: string; applied_at: string; }
interface Session { id: string; date: string; start_hour: number; end_hour: number; court_name: string | null; trainer_name: string | null; status: string; booking_id: string | null; }

type Tab = 'overview' | 'registrations' | 'sessions';
const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  const load = async () => {
    const [c, r, s] = await Promise.all([
      fetch(`${API}/courses/${id}`).then(r => r.json()),
      fetch(`${API}/courses/${id}/registrations`).then(r => r.json()),
      fetch(`${API}/courses/${id}/sessions`).then(r => r.json()),
    ]);
    setCourse(c.data ?? null);
    setRegistrations(r.data ?? []);
    setSessions(s.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id]);

  const approveRegs = async (ids: string[], status: string) => {
    await fetch(`${API}/courses/${id}/registrations`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status }),
    });
    flash(`${ids.length} ${status === 'approved' ? 'godkända' : 'avvisade'}`);
    load();
  };

  const generateSessions = async () => {
    const res = await fetch(`${API}/courses/${id}/sessions/generate`, { method: 'POST' }).then(r => r.json());
    if (res.success) { flash(`${res.data.generated} sessioner skapade`); load(); }
    else flash(res.error ?? 'Fel');
  };

  const updateStatus = async (status: string) => {
    await fetch(`${API}/courses/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    flash(`Status ändrad till ${status}`);
    load();
  };

  const updateRegStatus = async (regStatus: string) => {
    await fetch(`${API}/courses/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationStatus: regStatus }),
    });
    flash(`Registration ${regStatus}`);
    load();
  };

  if (loading) return <div className="loading">Laddar kurs...</div>;
  if (!course) return <div className="empty-state"><h3>Kurs hittades inte</h3></div>;

  const pending = registrations.filter(r => r.status === 'pending');
  const approved = registrations.filter(r => r.status === 'approved');

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/courses" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 12 }}>← Kurser</Link>
          <h1 style={{ marginTop: 4 }}>{course.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {course.status === 'draft' && <button className="btn btn-primary" onClick={() => updateStatus('active')}>Aktivera</button>}
          {course.status === 'active' && <button className="btn btn-outline" onClick={() => updateStatus('completed')}>Avsluta</button>}
          {course.registration_status !== 'open' && <button className="btn btn-outline" onClick={() => updateRegStatus('open')}>Öppna registrering</button>}
          {course.registration_status === 'open' && <button className="btn btn-outline" onClick={() => updateRegStatus('closed')}>Stäng registrering</button>}
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['overview', 'registrations', 'sessions'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: tab === t ? 700 : 500,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            border: `1.5px solid ${tab === t ? '#6366f1' : 'var(--border)'}`,
            background: tab === t ? '#eef2ff' : 'var(--bg-card)',
            color: tab === t ? '#4f46e5' : 'var(--text-muted)',
          }}>
            {{ overview: 'Översikt', registrations: `Anmälningar (${registrations.length})`, sessions: `Sessioner (${sessions.length})` }[t]}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <InfoCard label="Schema" value={`${DAY_NAMES[course.day_of_week]} ${String(course.start_hour).padStart(2, '0')}:00–${String(course.end_hour).padStart(2, '0')}:00`} />
          <InfoCard label="Bana" value={course.court_name ?? '?'} />
          <InfoCard label="Tränare" value={course.trainer_name ?? 'Ingen'} />
          <InfoCard label="Termin" value={`${course.term_start} → ${course.term_end}`} />
          <InfoCard label="Deltagare" value={`${approved.length}/${course.max_participants ?? '∞'}`} />
          <InfoCard label="Pris" value={course.price_total ? `${course.price_total} SEK` : 'Gratis'} />
          <InfoCard label="Sport" value={course.sport_type} />
          <InfoCard label="Kategori" value={course.category} />
          {course.description && <div style={{ gridColumn: 'span 2', padding: 16, background: 'var(--bg-body)', borderRadius: 10, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>{course.description}</div>}
        </div>
      )}

      {/* Registrations */}
      {tab === 'registrations' && (
        <div>
          {pending.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Väntande ({pending.length})</h3>
                <button className="btn btn-primary" onClick={() => approveRegs(pending.map(r => r.id), 'approved')} style={{ padding: '6px 16px', fontSize: 12 }}>Godkänn alla</button>
              </div>
              {pending.map(r => (
                <RegRow key={r.id} reg={r} onApprove={() => approveRegs([r.id], 'approved')} onReject={() => approveRegs([r.id], 'rejected')} />
              ))}
            </div>
          )}
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Godkända ({approved.length})</h3>
          {approved.length === 0 ? <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Inga godkända deltagare ännu.</p> :
            approved.map(r => <RegRow key={r.id} reg={r} approved />)}
          {registrations.filter(r => r.status === 'waitlisted').length > 0 && (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 20, marginBottom: 10 }}>Väntelista</h3>
              {registrations.filter(r => r.status === 'waitlisted').map(r => <RegRow key={r.id} reg={r} onApprove={() => approveRegs([r.id], 'approved')} />)}
            </>
          )}
        </div>
      )}

      {/* Sessions */}
      {tab === 'sessions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>{sessions.length} sessioner</h3>
            <button className="btn btn-primary" onClick={generateSessions}>Generera sessioner</button>
          </div>
          {sessions.length === 0 ? (
            <div className="empty-state"><p style={{ fontSize: 42, marginBottom: 8 }}>📅</p><h3>Inga sessioner</h3><p style={{ color: 'var(--text-dim)' }}>Klicka "Generera sessioner" för att skapa dem från kursens schema.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sessions.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      {new Date(s.date + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>
                      {String(s.start_hour).padStart(2, '0')}:00–{String(s.end_hour).padStart(2, '0')}:00
                    </span>
                    {s.court_name && <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8 }}>{s.court_name}</span>}
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: s.status === 'scheduled' ? '#ecfdf5' : s.status === 'cancelled' ? '#fef2f2' : '#eef2ff', color: s.status === 'scheduled' ? '#059669' : s.status === 'cancelled' ? '#dc2626' : '#4f46e5' }}>{s.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, textTransform: 'capitalize' }}>{value}</div>
    </div>
  );
}

function RegRow({ reg: r, onApprove, onReject, approved }: { reg: any; onApprove?: () => void; onReject?: () => void; approved?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', marginBottom: 6 }}>
      <div>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{r.user_name}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{r.user_email}</span>
        {r.user_phone && <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8 }}>{r.user_phone}</span>}
        <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>{new Date(r.applied_at).toLocaleDateString('sv-SE')}</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {!approved && onApprove && <button onClick={onApprove} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid #a7f3d0', background: '#ecfdf5', color: '#059669', cursor: 'pointer', fontFamily: 'inherit' }}>Godkänn</button>}
        {!approved && onReject && <button onClick={onReject} style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit' }}>Avvisa</button>}
        {approved && <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#ecfdf5', color: '#059669' }}>✓ Godkänd</span>}
      </div>
    </div>
  );
}
