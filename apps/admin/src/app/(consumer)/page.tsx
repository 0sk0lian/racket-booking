'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface Club {
  id: string;
  slug?: string | null;
  name: string;
  city: string | null;
}

interface Court {
  id: string;
  club_id: string;
  name: string;
  sport_type: string;
  base_hourly_rate: number;
}

interface Membership {
  club_id: string;
  status: string;
  membership_type: string;
  club_name?: string | null;
}

interface Booking {
  id: string;
  court_name: string;
  club_name: string;
  time_slot_start: string;
  time_slot_end: string;
}

export default function HomePage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/clubs').then((r) => r.json()),
      fetch('/api/courts').then((r) => r.json()),
      fetch('/api/users/me/memberships').then((r) => r.json()),
      fetch('/api/bookings/my').then((r) => r.json()),
    ]).then(([clubResponse, courtResponse, membershipResponse, bookingResponse]) => {
      setClubs(clubResponse.data ?? []);
      setCourts(courtResponse.data ?? []);
      setMemberships(membershipResponse.data ?? []);
      setBookings(bookingResponse.data ?? []);
    });
  }, []);

  const membershipMap = useMemo(
    () => new Map(memberships.map((membership) => [membership.club_id, membership])),
    [memberships],
  );

  const filteredClubs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...clubs]
      .filter((club) => {
        if (!normalizedQuery) return true;
        const sports = [...new Set(courts.filter((court) => court.club_id === club.id).map((court) => court.sport_type))].join(' ');
        return `${club.name} ${club.city ?? ''} ${sports}`.toLowerCase().includes(normalizedQuery);
      })
      .sort((a, b) => {
        const aMembership = membershipMap.has(a.id) ? 0 : 1;
        const bMembership = membershipMap.has(b.id) ? 0 : 1;
        if (aMembership !== bMembership) return aMembership - bMembership;
        return a.name.localeCompare(b.name, 'sv');
      });
  }, [clubs, courts, membershipMap, query]);

  const upcomingBookings = bookings
    .filter((booking) => new Date(booking.time_slot_start) > new Date())
    .slice(0, 3);

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '36px 24px 48px' }}>
      <section style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginBottom: 28 }}>
        <div style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f0fdfa 100%)', border: '1px solid #dbeafe', borderRadius: 22, padding: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#4f46e5', marginBottom: 10 }}>Start</div>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1.1, marginBottom: 12 }}>Välj anläggning och fortsätt där du slutade</h1>
          <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.7, maxWidth: 620, marginBottom: 22 }}>
            Dina klubbar visas först. Sök efter stad, sport eller anläggning och gå direkt till att boka bana, bli medlem eller anmäla dig till kurs.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/clubs" style={primaryBtn}>Alla anläggningar</Link>
            <Link href="/my" style={secondaryBtn}>Mitt konto</Link>
          </div>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 22, padding: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#64748b', marginBottom: 12 }}>Snabböversikt</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
            <MiniStat label="Mina klubbar" value={String(memberships.length)} accent="#4f46e5" />
            <MiniStat label="Kommande bokningar" value={String(upcomingBookings.length)} accent="#059669" />
          </div>
          {upcomingBookings.length === 0 ? (
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>Inga kommande bokningar ännu. Välj en anläggning för att boka din nästa tid.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcomingBookings.map((booking) => (
                <div key={booking.id} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{booking.court_name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{booking.club_name}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                    {new Date(booking.time_slot_start).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })} · {new Date(booking.time_slot_start).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Anläggningar</h2>
            <div style={{ fontSize: 13, color: '#64748b' }}>Dina medlemsklubbar visas först</div>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Sök stad, sport eller anläggning"
            style={{ width: 320, maxWidth: '100%', padding: '11px 14px', borderRadius: 12, border: '1px solid #dbe3ef', fontSize: 14, fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
          {filteredClubs.map((club) => {
            const clubCourts = courts.filter((court) => court.club_id === club.id);
            const sports = [...new Set(clubCourts.map((court) => court.sport_type))];
            const minPrice = clubCourts.length > 0 ? Math.min(...clubCourts.map((court) => court.base_hourly_rate)) : null;
            const membership = membershipMap.get(club.id);
            return (
              <Link key={club.id} href={`/clubs/${club.slug || club.id}`} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 18, textDecoration: 'none', color: 'inherit', boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{club.name}</h3>
                    <div style={{ fontSize: 13, color: '#64748b' }}>{club.city ?? 'Sverige'} · {clubCourts.length} {clubCourts.length === 1 ? 'bana' : 'banor'}</div>
                  </div>
                  {membership && <span style={{ padding: '5px 10px', borderRadius: 999, background: membership.status === 'active' ? '#ecfdf5' : '#fef3c7', color: membership.status === 'active' ? '#059669' : '#b45309', fontSize: 11, fontWeight: 700 }}>{membership.membership_type}</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {sports.map((sport) => <span key={sport} style={sportPill}>{sport}</span>)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>{minPrice != null ? `Från ${minPrice} SEK/h` : 'Se priser'}</span>
                  <span style={{ fontSize: 13, color: '#4f46e5', fontWeight: 700 }}>Öppna ?</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent }}>{value}</div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '12px 22px', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#fff', background: '#4f46e5', textDecoration: 'none',
};
const secondaryBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '12px 22px', borderRadius: 12, fontSize: 14, fontWeight: 700, color: '#4f46e5', background: '#fff', border: '1px solid #dbe3ef', textDecoration: 'none',
};
const sportPill: React.CSSProperties = {
  padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#f1f5f9', color: '#475569', textTransform: 'capitalize',
};
