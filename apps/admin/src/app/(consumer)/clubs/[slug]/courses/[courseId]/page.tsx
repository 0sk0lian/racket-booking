'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';

const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

interface Course {
  id: string;
  name: string;
  description: string | null;
  sport_type: string;
  category: string;
  court_name: string;
  trainer_name: string | null;
  day_of_week: number;
  start_hour: number;
  end_hour: number;
  term_start: string;
  term_end: string;
  max_participants: number | null;
  price_total: number | null;
  price_per_session: number | null;
  registration_status: string;
  registration_form_id: string | null;
}

interface Session {
  id: string;
  date: string;
  start_hour: number;
  end_hour: number;
  status: string;
}

interface FormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'date';
  required?: boolean;
  options?: string[];
}

function toDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function CourseDetailConsumer() {
  const { slug, courseId } = useParams<{ slug: string; courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [regStatus, setRegStatus] = useState<string>('none');
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    Promise.all([
      fetch(`/api/courses/${courseId}`).then((r) => r.json()),
      fetch(`/api/courses/${courseId}/sessions`).then((r) => r.json()),
      fetch(`/api/courses/${courseId}/registrations?mine=true`).then((r) => r.json()),
    ]).then(async ([courseResponse, sessionsResponse, registrationsResponse]) => {
      const loadedCourse = courseResponse.data ?? null;
      setCourse(loadedCourse);
      setSessions((sessionsResponse.data ?? []).filter((session: Session) => session.status === 'scheduled'));

      const myRegistrations = registrationsResponse?.data ?? [];
      if (Array.isArray(myRegistrations) && myRegistrations.length > 0) {
        setRegStatus(myRegistrations[0].status ?? 'none');
      } else {
        setRegStatus('none');
      }

      if (loadedCourse?.registration_form_id) {
        const formResponse = await fetch(`/api/registration-forms/${loadedCourse.registration_form_id}`).then((r) => r.json());
        setFormFields(formResponse.data?.fields ?? []);
      }

      setLoading(false);
    });
  }, [courseId]);

  const upcoming = useMemo(
    () => sessions.filter((session) => session.date >= toDateStr(new Date())).slice(0, 8),
    [sessions],
  );

  const updateAnswer = (key: string, value: string | boolean) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  const validate = () => {
    for (const field of formFields) {
      const value = answers[field.key];
      if (field.required && (value === undefined || value === '' || value === false)) {
        return `${field.label} måste fyllas i`;
      }
    }
    return null;
  };

  const register = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setRegistering(true);
    setError('');
    const response = await fetch(`/api/courses/${courseId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    const result = await response.json().catch(() => ({}));

    if (response.status === 401) {
      setRegistering(false);
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
      return;
    }

    if (result.success) {
      setRegStatus(result.data.status);
      setToast(result.data.status === 'waitlisted' ? 'Du står på väntelistan' : 'Ansökan skickad!');
    } else {
      setError(result.error ?? 'Misslyckades');
    }

    setRegistering(false);
    setTimeout(() => setToast(''), 4000);
  };

  if (loading) return <div style={{ padding: 40, color: '#94a3b8' }}>Laddar...</div>;
  if (!course) return <div style={{ padding: 40 }}><h2>Kurs hittades inte</h2></div>;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <Link href={`/clubs/${slug}/courses`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 13, marginBottom: 16, display: 'inline-block' }}>? Alla kurser</Link>

      {toast && <div style={{ padding: '10px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, color: '#059669', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{toast}</div>}
      {error && <div style={{ padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{error}</div>}

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

          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Kommande pass</h2>
          {upcoming.length === 0 ? <p style={{ color: '#94a3b8' }}>Inga kommande pass.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {upcoming.map((session) => (
                <div key={session.id} style={{ padding: '10px 16px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}>
                  {new Date(session.date + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  <span style={{ color: '#64748b', marginLeft: 8 }}>{String(session.start_hour).padStart(2, '0')}:00–{String(session.end_hour).padStart(2, '0')}:00</span>
                </div>
              ))}
              {sessions.length > 8 && <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>+ {sessions.length - 8} fler pass</p>}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Kursinfo</div>
          <Info label="Termin" value={`${course.term_start} ? ${course.term_end}`} />
          <Info label="Pass" value={`${sessions.length} tillfällen`} />
          <Info label="Sport" value={course.sport_type} />
          <Info label="Kategori" value={course.category} />
          {course.max_participants && <Info label="Platser" value={`Max ${course.max_participants}`} />}

          <div style={{ borderTop: '1px solid #e2e8f0', margin: '16px 0', paddingTop: 16 }}>
            {course.price_total ? (
              <div style={{ fontSize: 24, fontWeight: 800, color: '#6366f1', marginBottom: 4 }}>{course.price_total} SEK</div>
            ) : (
              <div style={{ fontSize: 20, fontWeight: 700, color: '#059669', marginBottom: 4 }}>Gratis</div>
            )}
            {course.price_per_session && <div style={{ fontSize: 12, color: '#94a3b8' }}>eller {course.price_per_session} SEK/pass</div>}
          </div>

          {regStatus === 'none' && course.registration_status === 'open' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {formFields.map((field) => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                    {field.label}{field.required ? ' *' : ''}
                  </label>
                  {field.type === 'text' && <input type="text" value={String(answers[field.key] ?? '')} onChange={(event) => updateAnswer(field.key, event.target.value)} style={formInput} />}
                  {field.type === 'number' && <input type="number" value={String(answers[field.key] ?? '')} onChange={(event) => updateAnswer(field.key, event.target.value)} style={formInput} />}
                  {field.type === 'date' && <input type="date" value={String(answers[field.key] ?? '')} onChange={(event) => updateAnswer(field.key, event.target.value)} style={formInput} />}
                  {field.type === 'select' && (
                    <select value={String(answers[field.key] ?? '')} onChange={(event) => updateAnswer(field.key, event.target.value)} style={formInput}>
                      <option value="">Välj...</option>
                      {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  )}
                  {field.type === 'checkbox' && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#334155' }}>
                      <input type="checkbox" checked={Boolean(answers[field.key])} onChange={(event) => updateAnswer(field.key, event.target.checked)} />
                      Ja
                    </label>
                  )}
                </div>
              ))}

              <button onClick={register} disabled={registering} style={{ width: '100%', padding: '14px 0', borderRadius: 12, fontSize: 15, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', cursor: registering ? 'wait' : 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
                {registering ? 'Skickar...' : 'Skicka ansökan'}
              </button>
            </div>
          )}
          {regStatus === 'pending' && <div style={{ textAlign: 'center', padding: 12, background: '#fef3c7', borderRadius: 10, color: '#b45309', fontWeight: 600, fontSize: 13 }}>Ansökan inskickad – väntar på godkännande</div>}
          {regStatus === 'approved' && <div style={{ textAlign: 'center', padding: 12, background: '#eef2ff', borderRadius: 10, color: '#4f46e5', fontWeight: 600, fontSize: 13 }}>Ansökan godkänd – väntar på placering och faktura</div>}
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

const formInput: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1px solid #e2e8f0', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' as any,
};
