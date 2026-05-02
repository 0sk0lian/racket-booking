'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface EventData {
  id: string;
  event_name: string;
  court_name: string;
  date: string;
  start: string;
  end: string;
  max_participants: number | null;
  attendee_count: number;
  spots_left: number | null;
  is_full: boolean;
  user_signed_up: boolean;
  notes: string | null;
}

export default function EventDetailPage() {
  const { slug, eventId } = useParams<{ slug: string; eventId: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/clubs/${slug}/events`)
      .then(r => r.json())
      .then(r => {
        const events: EventData[] = r.data ?? [];
        const found = events.find(e => e.id === eventId) ?? null;
        setEvent(found);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug, eventId]);

  const signup = async () => {
    setSigning(true);
    setError('');
    const res = await fetch(`/api/events/${eventId}/signup`, { method: 'POST' });

    if (res.status === 401) {
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `/login?next=${next}`;
      return;
    }

    const result = await res.json().catch(() => ({}));
    if (result.success) {
      setEvent(prev => prev ? {
        ...prev,
        user_signed_up: true,
        attendee_count: prev.attendee_count + 1,
        spots_left: prev.spots_left !== null ? prev.spots_left - 1 : null,
        is_full: prev.max_participants ? (prev.attendee_count + 1) >= prev.max_participants : false,
      } : prev);
      setToast('Du ar anmald!');
    } else {
      setError(result.error ?? 'Kunde inte anmala');
    }
    setSigning(false);
    setTimeout(() => setToast(''), 4000);
  };

  if (loading) return <div style={{ padding: 40, color: '#94a3b8' }}>Laddar...</div>;
  if (!event) return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
      <p style={{ fontSize: 42, marginBottom: 8 }}>?</p>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Event hittades inte</h2>
      <Link href={`/clubs/${slug}`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 14 }}>Tillbaka till klubben</Link>
    </div>
  );

  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const dateStr = startDate.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const startTime = startDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  const endTime = endDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
      <Link href={`/clubs/${slug}`} style={{ color: '#6366f1', textDecoration: 'none', fontSize: 13, marginBottom: 16, display: 'inline-block' }}>
        &larr; Tillbaka
      </Link>

      {toast && (
        <div style={{ padding: '10px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 10, color: '#059669', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          {toast}
        </div>
      )}
      {error && (
        <div style={{ padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left: Event details */}
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{event.event_name}</h1>
          <div style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
            {dateStr} &middot; {startTime}&ndash;{endTime} &middot; {event.court_name}
          </div>

          {event.notes && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20, marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Beskrivning</h2>
              <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{event.notes}</p>
            </div>
          )}
        </div>

        {/* Right: Info card + signup */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Eventinfo
          </div>

          <InfoRow label="Datum" value={startDate.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })} />
          <InfoRow label="Tid" value={`${startTime} - ${endTime}`} />
          <InfoRow label="Bana" value={event.court_name} />

          {event.max_participants && (
            <>
              <InfoRow label="Platser" value={`${event.attendee_count} / ${event.max_participants}`} />
              <div style={{ marginTop: 8, marginBottom: 4 }}>
                <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, (event.attendee_count / event.max_participants) * 100)}%`,
                    background: event.is_full ? '#ef4444' : '#6366f1',
                    borderRadius: 3,
                    transition: 'width 0.3s',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, textAlign: 'right' }}>
                  {event.spots_left !== null ? `${event.spots_left} platser kvar` : ''}
                </div>
              </div>
            </>
          )}

          <div style={{ borderTop: '1px solid #e2e8f0', margin: '16px 0', paddingTop: 16 }}>
            {event.user_signed_up ? (
              <div style={{
                textAlign: 'center',
                padding: 14,
                background: '#ecfdf5',
                borderRadius: 12,
                color: '#059669',
                fontWeight: 700,
                fontSize: 14,
              }}>
                Du ar anmald
              </div>
            ) : event.is_full ? (
              <div style={{
                textAlign: 'center',
                padding: 14,
                background: '#f1f5f9',
                borderRadius: 12,
                color: '#64748b',
                fontWeight: 700,
                fontSize: 14,
              }}>
                Fullt
              </div>
            ) : (
              <button
                onClick={signup}
                disabled={signing}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  border: 'none',
                  cursor: signing ? 'wait' : 'pointer',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                }}
              >
                {signing ? 'Anmaler...' : 'Anmal dig'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
