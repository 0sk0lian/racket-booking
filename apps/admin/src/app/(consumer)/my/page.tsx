'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Booking { id: string; court_name: string; club_name: string; sport_type: string; time_slot_start: string; time_slot_end: string; status: string; access_pin: string; total_price: number; }

export default function MyDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/bookings/my').then(r => r.json()).then(r => { setBookings(r.data ?? []); setLoading(false); });
  }, []);

  const now = new Date();
  const upcoming = bookings.filter(b => new Date(b.time_slot_start) > now && b.status !== 'cancelled').slice(0, 3);
  const nextBooking = upcoming[0];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Mitt konto</h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 32 }}>Välkommen tillbaka!</p>

      {loading ? (
        <p style={{ color: '#94a3b8' }}>Laddar...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: nextBooking ? '1fr 1fr' : '1fr', gap: 20, marginBottom: 32 }}>
          {/* Next booking highlight */}
          {nextBooking && (
            <div style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', borderRadius: 16, padding: 28, color: '#fff' }}>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7, marginBottom: 8 }}>Nästa bokning</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{nextBooking.court_name}</div>
              <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 12 }}>
                {new Date(nextBooking.time_slot_start).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                {' · '}
                {new Date(nextBooking.time_slot_start).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                –{new Date(nextBooking.time_slot_end).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
              </div>
              {nextBooking.access_pin && (
                <div style={{ display: 'inline-block', padding: '6px 14px', background: 'rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 18, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 2 }}>
                  PIN: {nextBooking.access_pin}
                </div>
              )}
            </div>
          )}

          {/* Quick actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <QuickAction href="/clubs" icon="🎾" label="Boka ny tid" desc="Hitta en ledig bana" />
            <QuickAction href="/my/bookings" icon="📅" label="Mina bokningar" desc={`${upcoming.length} kommande`} />
            <QuickAction href="/my/trainings" icon="🏋️" label="Mina träningar" desc="Se pass och RSVP" />
            <QuickAction href="/my/profile" icon="👤" label="Profil" desc="Redigera uppgifter" />
          </div>
        </div>
      )}

      {/* Upcoming bookings preview */}
      {upcoming.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Kommande bokningar</h2>
            <Link href="/my/bookings" style={{ fontSize: 13, color: '#6366f1', textDecoration: 'none' }}>Visa alla →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcoming.map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{b.court_name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {new Date(b.time_slot_start).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {' '}
                    {new Date(b.time_slot_start).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                    –{new Date(b.time_slot_end).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#6366f1' }}>{b.total_price?.toFixed(0)} SEK</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && bookings.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
          <p style={{ fontSize: 42, marginBottom: 12 }}>🎾</p>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#334155' }}>Inga bokningar ännu</h3>
          <p style={{ marginBottom: 16 }}>Dags att boka din första tid!</p>
          <Link href="/clubs" style={{ display: 'inline-flex', padding: '12px 24px', borderRadius: 10, background: '#6366f1', color: '#fff', fontWeight: 600, textDecoration: 'none' }}>
            Hitta en bana
          </Link>
        </div>
      )}
    </div>
  );
}

function QuickAction({ href, icon, label, desc }: { href: string; icon: string; label: string; desc: string }) {
  return (
    <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', textDecoration: 'none', color: 'inherit', transition: 'border-color 0.15s' }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, color: '#64748b' }}>{desc}</div>
      </div>
    </Link>
  );
}
