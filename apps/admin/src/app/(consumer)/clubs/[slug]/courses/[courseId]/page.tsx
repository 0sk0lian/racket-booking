'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

interface Course { id: string; name: string; description: string | null; sport_type: string; category: string; court_name: string; trainer_name: string | null; day_of_week: number; start_hour: number; end_hour: number; term_start: string; term_end: string; max_participants: number | null; price_total: number | null; price_per_session: number | null; registration_status: string; }
interface Session { id: string; date: string; start_hour: number; end_hour: number; status: string; }

export default function CourseDetailConsumer() {
  const { slug, courseId } = useParams<{ slug: string; courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [regStatus, setRegStatus] = useState<string>('none');
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/courses/${courseId}`).then(r => r.json()),
      fetch(`/api/courses/${courseId}/sessions`).then(r => r.json()),
    ]).then(([c, s]) => {
      setCourse(c.data ?? null);
      setSessions((s.data ?? []).filter((x: Session) => x.status === 'scheduled'));
      setLoading(false);
    });
    // Check registration status
    fetch(`/api/courses/${courseId}/registrations`).then(r => r.json()).then(r => {
      // Find current user's registration (the API returns all for admins, but for consumers it should be filtered — for now check all)
      // The register endpoint will tell us if already registered
    });
  }, [courseId]);

  const register = async () => {
    setRegistering(true);
    const res = await fetch(`/api/courses/${courseId}/register`, { method: 'POST' }).then(r => r.json());
    if (res.success) {
      setRegStatus(res.data.status);
      setToast(res.data.status === 'waitlisted' ? 'Du står på väntelistan' : 'Anmälan skickad!');
    } else {
      setToast(res.error ?? 'Misslyckades');
    }
    setRegistering(false);
    setTimeout(() => setToast(''), 4000);
  };

  if (loading) return <div style={{ padding: 40, color: '#94a3b8' }}>Laddar...</div>;
  if (!course) return <div style={{ padding: 40 }}><h2>Kurs hittades inte</h2></div>;

  const upcoming = sessions.filter(s => s.date >= new Date().toISOString().split('T')[0]).slice(0, 8);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <Link href={`/clubs/${slug}/courses`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 13, marginBottom: 16, display: 'inline-block' }}>← Alla kurser</Link>

      {toast && <div style={{ padding: '10px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, color: '#059669', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{toast}</div>}

      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{course.name}</h1>
      <div style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
        {DAY_NAMES[course.day_of_week]} {String(course.start_hour).padStart(2, '0')}:00–{String(course.end_hour).padStart(2, '0')}:00 · {course.court_name}
        {course.trainer_name && ` · Tränare: ${course.trainer_name}`}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        <div>
          {course.description && (
            <div style={{ fontSize: 15, color: '#475569', lineHeight: 1.7, marginBottom: 24 }}>{course.description}</div>
          )}

          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Kommande sessioner</h2>
          {upcoming.length === 0 ? <p style={{ color: '#94a3b8' }}>Inga kommande sessioner.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcoming.map(s => (
                <div key={s.id} style={{ padding: '10px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}>
                  {new Date(s.date + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  <span style={{ color: '#64748b', marginLeft: 8 }}>{String(s.start_hour).padStart(2, '0')}:00–{String(s.end_hour).padStart(2, '0')}:00</span>
                </div>
              ))}
              {sessions.length > 8 && <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>+ {sessions.length - 8} fler sessioner</p>}
            </div>
          )}
        </div>

        {/* Registration sidebar */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Kursinfo</div>
          <Info label="Termin" value={`${course.term_start} → ${course.term_end}`} />
          <Info label="Sessioner" value={`${sessions.length} tillfällen`} />
          <Info label="Sport" value={course.sport_type} />
          <Info label="Kategori" value={course.category} />
          {course.max_participants && <Info label="Platser" value={`Max ${course.max_participants}`} />}

          <div style={{ borderTop: '1px solid #e2e8f0', margin: '16px 0', paddingTop: 16 }}>
            {course.price_total ? (
              <div style={{ fontSize: 24, fontWeight: 800, color: '#6366f1', marginBottom: 4 }}>{course.price_total} SEK</div>
            ) : (
              <div style={{ fontSize: 20, fontWeight: 700, color: '#059669', marginBottom: 4 }}>Gratis</div>
            )}
            {course.price_per_session && <div style={{ fontSize: 12, color: '#94a3b8' }}>eller {course.price_per_session} SEK/gång</div>}
          </div>

          {regStatus === 'none' && course.registration_status === 'open' && (
            <button onClick={register} disabled={registering} style={{ width: '100%', padding: '14px 0', borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', cursor: registering ? 'wait' : 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
              {registering ? 'Anmäler...' : 'Anmäl mig'}
            </button>
          )}
          {regStatus === 'pending' && <div style={{ textAlign: 'center', padding: 12, background: '#fef3c7', borderRadius: 10, color: '#b45309', fontWeight: 600, fontSize: 13 }}>Ansökan inskickad — väntar på godkännande</div>}
          {regStatus === 'approved' && <div style={{ textAlign: 'center', padding: 12, background: '#ecfdf5', borderRadius: 10, color: '#059669', fontWeight: 600, fontSize: 13 }}>✓ Du är anmäld!</div>}
          {regStatus === 'waitlisted' && <div style={{ textAlign: 'center', padding: 12, background: '#fef3c7', borderRadius: 10, color: '#b45309', fontWeight: 600, fontSize: 13 }}>Du står på väntelistan</div>}
          {course.registration_status === 'closed' && regStatus === 'none' && <div style={{ textAlign: 'center', padding: 12, background: '#f1f5f9', borderRadius: 10, color: '#64748b', fontWeight: 600, fontSize: 13 }}>Anmälan stängd</div>}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{value}</span>
    </div>
  );
}
