'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface Booking { id: string; court_name: string; club_name: string; sport_type: string; time_slot_start: string; time_slot_end: string; status: string; access_pin: string; total_price: number; booking_type: string; }

export default function MyBookingsPage() {
  return <Suspense fallback={<div style={{ padding: 40, color: '#94a3b8' }}>Laddar...</div>}><Inner /></Suspense>;
}

function Inner() {
  const params = useSearchParams();
  const justBooked = params.get('booked');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [toast, setToast] = useState(justBooked ? 'Bokning bekräftad!' : '');

  useEffect(() => {
    fetch('/api/bookings/my').then(r => r.json()).then(r => { setBookings(r.data ?? []); setLoading(false); });
  }, []);

  const cancel = async (id: string) => {
    if (!confirm('Vill du avboka denna tid?')) return;
    setCancelling(id);
    const res = await fetch(`/api/bookings/${id}`, { method: 'PATCH' }).then(r => r.json());
    if (res.success) {
      setBookings(bookings.filter(b => b.id !== id));
      setToast('Bokning avbokad');
    } else {
      setToast(res.error ?? 'Avbokning misslyckades');
    }
    setCancelling(null);
    setTimeout(() => setToast(''), 4000);
  };

  const now = new Date();
  const upcoming = bookings.filter(b => new Date(b.time_slot_start) > now).sort((a, b) => a.time_slot_start.localeCompare(b.time_slot_start));
  const past = bookings.filter(b => new Date(b.time_slot_start) <= now).slice(0, 10);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Mina bokningar</h1>

      {toast && (
        <div style={{ padding: '12px 18px', background: toast.includes('misslyckades') ? '#fef2f2' : '#ecfdf5', border: `1px solid ${toast.includes('misslyckades') ? '#fecaca' : '#a7f3d0'}`, borderRadius: 10, color: toast.includes('misslyckades') ? '#b91c1c' : '#059669', fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
          {toast}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#94a3b8', padding: 20 }}>Laddar bokningar...</p>
      ) : (
        <>
          {/* Upcoming */}
          <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24, marginBottom: 12 }}>
            Kommande ({upcoming.length})
          </h2>
          {upcoming.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 12 }}>
              Inga kommande bokningar. <Link href="/clubs" style={{ color: '#6366f1' }}>Boka en tid</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
              {upcoming.map(b => (
                <BookingCard key={b.id} booking={b} onCancel={() => cancel(b.id)} cancelling={cancelling === b.id} showCancel />
              ))}
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 24, marginBottom: 12, color: '#64748b' }}>
                Tidigare ({past.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: 0.7 }}>
                {past.map(b => <BookingCard key={b.id} booking={b} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function BookingCard({ booking: b, onCancel, cancelling, showCancel }: { booking: any; onCancel?: () => void; cancelling?: boolean; showCancel?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
      <div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{b.court_name ?? 'Court'}</span>
          <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: '#f1f5f9', color: '#475569', textTransform: 'capitalize' }}>{b.booking_type}</span>
        </div>
        <div style={{ fontSize: 13, color: '#64748b' }}>
          {b.club_name ?? ''} · {new Date(b.time_slot_start).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}
          {' '}
          {new Date(b.time_slot_start).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
          –{new Date(b.time_slot_end).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
        </div>
        {b.access_pin && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>PIN: {b.access_pin}</div>}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#6366f1' }}>{b.total_price?.toFixed(0)} SEK</span>
        {showCancel && onCancel && (
          <button onClick={onCancel} disabled={cancelling} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: cancelling ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
            {cancelling ? '...' : 'Avboka'}
          </button>
        )}
      </div>
    </div>
  );
}
