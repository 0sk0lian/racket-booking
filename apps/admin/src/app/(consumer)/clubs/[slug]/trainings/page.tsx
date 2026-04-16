'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const DAY_NAMES = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];

interface Training {
  id: string; title: string; court_name: string; trainer_name: string | null;
  day_of_week: number; day_name: string; start_hour: number; end_hour: number;
  visibility: string; max_players: number | null; spots_left: number | null;
  user_status: string; notes: string | null;
}

export default function ClubTrainingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch(`/api/clubs/${slug}/trainings`).then(r => r.json()).then(r => { setTrainings(r.data ?? []); setLoading(false); });
  }, [slug]);

  const apply = async (sessionId: string) => {
    setApplying(sessionId);
    const res = await fetch(`/api/trainings/${sessionId}/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }).then(r => r.json());
    if (res.success) {
      setToast('Ansökan skickad!');
      // Refresh
      const r = await fetch(`/api/clubs/${slug}/trainings`).then(r => r.json());
      setTrainings(r.data ?? []);
    } else {
      setToast(res.error ?? 'Något gick fel');
    }
    setApplying(null);
    setTimeout(() => setToast(''), 4000);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <Link href={`/clubs/${slug}`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 13, marginBottom: 16, display: 'inline-block' }}>← Tillbaka</Link>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Träningspass</h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>Öppna pass du kan ansöka till. Admins godkänner din plats.</p>

      {toast && <div style={{ padding: '10px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, color: '#059669', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{toast}</div>}

      {loading ? <p style={{ color: '#94a3b8' }}>Laddar...</p> : trainings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <p style={{ fontSize: 42, marginBottom: 8 }}>🏋️</p>
          <h3 style={{ color: '#334155' }}>Inga öppna pass just nu</h3>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {trainings.map(t => (
            <div key={t.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{t.title}</h3>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: t.visibility === 'public' ? '#ecfdf5' : '#eef2ff', color: t.visibility === 'public' ? '#059669' : '#4f46e5' }}>
                  {t.visibility === 'public' ? 'Öppen' : 'Medlemmar'}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
                {DAY_NAMES[t.day_of_week]} {String(t.start_hour).padStart(2, '0')}:00–{String(t.end_hour).padStart(2, '0')}:00 · {t.court_name}
              </div>
              {t.trainer_name && <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, marginBottom: 8 }}>Tränare: {t.trainer_name}</div>}
              {t.spots_left !== null && <div style={{ fontSize: 12, color: t.spots_left > 0 ? '#059669' : '#dc2626', marginBottom: 10 }}>{t.spots_left > 0 ? `${t.spots_left} platser kvar` : 'Fullt'}</div>}

              {t.user_status === 'none' && (t.spots_left === null || t.spots_left > 0) && (
                <button onClick={() => apply(t.id)} disabled={applying === t.id} style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: '#6366f1', border: 'none', cursor: applying === t.id ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                  {applying === t.id ? 'Skickar...' : 'Ansök'}
                </button>
              )}
              {t.user_status === 'invited' && <span style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b' }}>Ansökan skickad — väntar på godkännande</span>}
              {t.user_status === 'going' && <span style={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>✓ Du är med</span>}
              {t.user_status === 'assigned' && <span style={{ fontSize: 12, fontWeight: 600, color: '#6366f1' }}>Tilldelad</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
