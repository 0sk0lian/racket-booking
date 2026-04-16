'use client';
import { useEffect, useState } from 'react';

interface TrainingAttendance {
  booking_id: string; user_id: string; status: string;
  booking: { id: string; court_name: string; start: string; end: string; booking_type: string; event_name: string | null; trainer_name: string | null; };
}

export default function MyTrainingsPage() {
  const [items, setItems] = useState<TrainingAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/users/me/attendance').then(r => r.json()).then(r => { setItems(r.data ?? []); setLoading(false); });
  };
  useEffect(load, []);

  const rsvp = async (bookingId: string, userId: string, status: 'going' | 'declined') => {
    setUpdating(bookingId);
    await fetch(`/api/bookings/${bookingId}/attendance/${userId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    load();
    setUpdating(null);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Mina träningar</h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>
        Träningspass du är inbjuden till. Svara om du kommer eller inte.
      </p>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Laddar...</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <p style={{ fontSize: 42, marginBottom: 12 }}>🏋️</p>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#334155' }}>Inga kommande träningar</h3>
          <p>Du har inga träningspass att svara på just nu.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(item => {
            const b = item.booking;
            const isUpdating = updating === b.id;
            return (
              <div key={b.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 22px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>
                      {b.event_name ?? b.court_name ?? 'Träning'}
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                      {b.court_name} · {new Date(b.start).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                      {' '}
                      {new Date(b.start).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                      –{new Date(b.end).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {b.trainer_name && (
                      <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, marginTop: 4 }}>Tränare: {b.trainer_name}</div>
                    )}
                  </div>
                  <StatusPill status={item.status} />
                </div>

                {/* RSVP buttons */}
                {(item.status === 'invited' || item.status === 'going' || item.status === 'declined') && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => rsvp(b.id, item.user_id, 'going')}
                      disabled={isUpdating || item.status === 'going'}
                      style={{
                        padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        cursor: isUpdating ? 'wait' : 'pointer', fontFamily: 'inherit',
                        border: item.status === 'going' ? 'none' : '1px solid #a7f3d0',
                        background: item.status === 'going' ? '#059669' : '#ecfdf5',
                        color: item.status === 'going' ? '#fff' : '#059669',
                      }}
                    >
                      {item.status === 'going' ? '✓ Jag kommer' : 'Jag kommer'}
                    </button>
                    <button
                      onClick={() => rsvp(b.id, item.user_id, 'declined')}
                      disabled={isUpdating || item.status === 'declined'}
                      style={{
                        padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                        cursor: isUpdating ? 'wait' : 'pointer', fontFamily: 'inherit',
                        border: item.status === 'declined' ? 'none' : '1px solid #fecaca',
                        background: item.status === 'declined' ? '#dc2626' : '#fef2f2',
                        color: item.status === 'declined' ? '#fff' : '#dc2626',
                      }}
                    >
                      {item.status === 'declined' ? '✗ Kan inte' : 'Kan inte'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    invited: { label: 'Inbjuden', bg: '#f1f5f9', color: '#475569' },
    going: { label: 'Kommer', bg: '#ecfdf5', color: '#059669' },
    declined: { label: 'Kan inte', bg: '#fef2f2', color: '#dc2626' },
    waitlist: { label: 'Väntelista', bg: '#f5f3ff', color: '#7c3aed' },
    present: { label: 'Närvarande', bg: '#ecfdf5', color: '#059669' },
    no_show: { label: 'Ej närvarande', bg: '#fef2f2', color: '#dc2626' },
  };
  const s = map[status] ?? { label: status, bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}
