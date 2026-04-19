'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const DAY_NAMES = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
const CAT_LABELS: Record<string, string> = { junior: 'Junior', adult: 'Vuxen', senior: 'Senior', camp: 'Läger', competition: 'Tävling', other: 'Övrigt' };

interface Course {
  id: string; name: string; description: string | null; sport_type: string; category: string;
  court_name: string; trainer_name: string | null; day_of_week: number; day_name: string;
  start_hour: number; end_hour: number; term_start: string; term_end: string;
  max_participants: number | null; price_total: number | null; price_per_session: number | null;
  registration_status: string; registrations_approved: number;
}

export default function ClubCoursesPage() {
  const { slug } = useParams<{ slug: string }>();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/courses?clubId=${slug}&status=active`).then(r => r.json()).then(r => { setCourses(r.data ?? []); setLoading(false); });
  }, [slug]);

  const open = courses.filter(c => c.registration_status === 'open' || c.registration_status === 'waitlist');
  const closed = courses.filter(c => c.registration_status === 'closed');

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <Link href={`/clubs/${slug}`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 13, marginBottom: 16, display: 'inline-block' }}>← Tillbaka</Link>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Kurser</h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>Anmäl dig till en kurs och träna regelbundet med tränare.</p>

      {loading ? <p style={{ color: '#94a3b8' }}>Laddar...</p> : courses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <p style={{ fontSize: 42, marginBottom: 8 }}>📚</p>
          <h3 style={{ color: '#334155' }}>Inga kurser just nu</h3>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Öppna för anmälan</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 32 }}>
                {open.map(c => <CourseCard key={c.id} course={c} slug={slug} />)}
              </div>
            </>
          )}
          {closed.length > 0 && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#64748b' }}>Stängda</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, opacity: 0.7 }}>
                {closed.map(c => <CourseCard key={c.id} course={c} slug={slug} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function CourseCard({ course: c, slug }: { course: Course; slug: string }) {
  const spotsLeft = c.max_participants ? Math.max(0, c.max_participants - c.registrations_approved) : null;
  return (
    <Link href={`/clubs/${slug}/courses/${c.id}`} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, textDecoration: 'none', color: 'inherit', transition: 'box-shadow 0.2s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{c.name}</h3>
        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: '#f1f5f9', color: '#475569', textTransform: 'capitalize' }}>{c.sport_type}</span>
      </div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
        {DAY_NAMES[c.day_of_week]} {String(c.start_hour).padStart(2, '0')}:00–{String(c.end_hour).padStart(2, '0')}:00 · {c.court_name}
      </div>
      {c.trainer_name && <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, marginBottom: 4 }}>Tränare: {c.trainer_name}</div>}
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{c.term_start} → {c.term_end} · {CAT_LABELS[c.category] ?? c.category}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {c.price_total ? <span style={{ fontSize: 15, fontWeight: 700, color: '#6366f1' }}>{c.price_total} SEK</span> : <span style={{ fontSize: 13, fontWeight: 600, color: '#059669' }}>Gratis</span>}
        </div>
        <div style={{ fontSize: 12 }}>
          {spotsLeft !== null && <span style={{ color: spotsLeft > 0 ? '#059669' : '#dc2626' }}>{spotsLeft > 0 ? `${spotsLeft} platser kvar` : 'Fullt'}</span>}
          {c.registration_status === 'waitlist' && <span style={{ color: '#f59e0b', marginLeft: 6 }}>Väntelista</span>}
        </div>
      </div>
    </Link>
  );
}
