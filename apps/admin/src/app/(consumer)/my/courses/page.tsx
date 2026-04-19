'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Registration { id: string; course_id: string; status: string; waitlist_position: number | null; applied_at: string; }
interface Course { id: string; name: string; sport_type: string; day_of_week: number; start_hour: number; end_hour: number; term_start: string; term_end: string; court_name: string; trainer_name: string | null; }

const DAY_NAMES = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
const STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: 'Väntar', bg: '#fef3c7', color: '#b45309' },
  approved: { label: 'Godkänd', bg: '#ecfdf5', color: '#059669' },
  waitlisted: { label: 'Väntelista', bg: '#f5f3ff', color: '#7c3aed' },
  rejected: { label: 'Avvisad', bg: '#fef2f2', color: '#dc2626' },
  cancelled: { label: 'Avbokad', bg: '#f1f5f9', color: '#64748b' },
};

export default function MyCoursesPage() {
  const [courses, setCourses] = useState<(Registration & { course?: Course })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get all courses the user is registered for
    // For now: fetch all courses and check registrations via the API
    // Ideally: a dedicated /api/users/me/courses endpoint
    fetch('/api/courses').then(r => r.json()).then(async (r) => {
      const allCourses = r.data ?? [];
      // Check each course for the user's registration
      const withRegs: any[] = [];
      for (const c of allCourses) {
        const regRes = await fetch(`/api/courses/${c.id}/registrations`).then(r => r.json());
        const myReg = (regRes.data ?? []).find((reg: any) => true); // TODO: filter by current user
        if (myReg) withRegs.push({ ...myReg, course: c });
      }
      setCourses(withRegs);
      setLoading(false);
    });
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Mina kurser</h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>Kurser du är anmäld till och deras status.</p>

      {loading ? <p style={{ color: '#94a3b8' }}>Laddar...</p> : courses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <p style={{ fontSize: 42, marginBottom: 8 }}>📚</p>
          <h3 style={{ color: '#334155' }}>Inga kurser</h3>
          <p>Du är inte anmäld till några kurser ännu.</p>
          <Link href="/clubs" style={{ display: 'inline-block', marginTop: 12, padding: '10px 20px', borderRadius: 8, background: '#6366f1', color: '#fff', fontWeight: 600, textDecoration: 'none' }}>Hitta kurser</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {courses.map(r => {
            const c = r.course;
            const s = STATUS[r.status] ?? STATUS.pending;
            return (
              <div key={r.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{c?.name ?? 'Kurs'}</h3>
                    {c && (
                      <div style={{ fontSize: 13, color: '#64748b' }}>
                        {DAY_NAMES[c.day_of_week]} {String(c.start_hour).padStart(2, '0')}:00–{String(c.end_hour).padStart(2, '0')}:00 · {c.court_name}
                        {c.trainer_name && ` · ${c.trainer_name}`}
                      </div>
                    )}
                    {c && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{c.term_start} → {c.term_end}</div>}
                  </div>
                  <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>
                </div>
                {r.status === 'waitlisted' && r.waitlist_position && (
                  <div style={{ fontSize: 12, color: '#7c3aed' }}>Position {r.waitlist_position} på väntelistan</div>
                )}
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Anmäld {new Date(r.applied_at).toLocaleDateString('sv-SE')}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
