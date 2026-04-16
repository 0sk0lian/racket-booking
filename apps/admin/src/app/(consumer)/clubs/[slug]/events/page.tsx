'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Event { id: string; event_name: string; court_name: string; start: string; end: string; max_participants: number | null; attendee_count: number; spots_left: number | null; is_full: boolean; user_signed_up: boolean; notes: string | null; }

export default function ClubEventsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const load = () => fetch(`/api/clubs/${slug}/events`).then(r => r.json()).then(r => { setEvents(r.data ?? []); setLoading(false); });
  useEffect(() => { load(); }, [slug]);

  const signup = async (eventId: string) => {
    setSigning(eventId);
    const res = await fetch(`/api/events/${eventId}/signup`, { method: 'POST' }).then(r => r.json());
    if (res.success) { setToast('Anmäld!'); load(); }
    else { setToast(res.error ?? 'Misslyckades'); }
    setSigning(null);
    setTimeout(() => setToast(''), 4000);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <Link href={`/clubs/${slug}`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 13, marginBottom: 16, display: 'inline-block' }}>← Tillbaka</Link>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 24 }}>Event</h1>

      {toast && <div style={{ padding: '10px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, color: '#059669', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{toast}</div>}

      {loading ? <p style={{ color: '#94a3b8' }}>Laddar...</p> : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <p style={{ fontSize: 42, marginBottom: 8 }}>🎉</p>
          <h3 style={{ color: '#334155' }}>Inga kommande event</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {events.map(e => (
            <div key={e.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{e.event_name}</h3>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  {e.court_name} · {new Date(e.start).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {' '}
                  {new Date(e.start).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                  –{new Date(e.end).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: 12, color: e.is_full ? '#dc2626' : '#059669', marginTop: 4 }}>
                  {e.attendee_count}/{e.max_participants ?? '∞'} anmälda
                  {e.spots_left !== null && ` · ${e.spots_left} platser kvar`}
                </div>
                {e.notes && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{e.notes}</div>}
              </div>
              <div>
                {e.user_signed_up ? (
                  <span style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#ecfdf5', color: '#059669' }}>✓ Anmäld</span>
                ) : e.is_full ? (
                  <span style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#fef2f2', color: '#dc2626' }}>Fullt</span>
                ) : (
                  <button onClick={() => signup(e.id)} disabled={signing === e.id} style={{ padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: '#ec4899', border: 'none', cursor: signing === e.id ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                    {signing === e.id ? '...' : 'Anmäl mig'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
