'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Club { id: string; name: string; city: string | null; contact_email: string | null; contact_phone: string | null; }
interface Court { id: string; name: string; sport_type: string; base_hourly_rate: number; is_indoor: boolean; }
interface VenueProfile { description: string | null; amenities: string[]; opening_hours: { day: number; open: string; close: string }[]; booking_rules: { max_days_ahead: number; cancellation_hours: number }; }

const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
const AMENITY_ICONS: Record<string, string> = {
  'omklädningsrum': '🚿', 'bastu': '🧖', 'parkering': '🅿️', 'café': '☕', 'pro-shop': '🏪', 'rackuthyrning': '🎾',
};

export default function ClubDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [club, setClub] = useState<Club | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [venue, setVenue] = useState<VenueProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // slug is currently the club UUID; in the future we'll add a slug field
    Promise.all([
      fetch('/api/clubs').then(r => r.json()),
      fetch(`/api/courts?clubId=${slug}`).then(r => r.json()),
    ]).then(([clubsRes, courtsRes]) => {
      const found = (clubsRes.data ?? []).find((c: Club) => c.id === slug);
      setClub(found ?? null);
      setCourts(courtsRes.data ?? []);

      // Fetch venue profile
      if (found) {
        fetch(`/api/venue-profiles?clubId=${found.id}`).then(r => r.json()).then(r => {
          setVenue(r.data?.[0] ?? null);
        }).catch(() => {});
      }
      setLoading(false);
    });
  }, [slug]);

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Laddar...</div>;
  if (!club) return <div style={{ padding: 60, textAlign: 'center' }}><h2>Anläggningen hittades inte</h2><Link href="/clubs" style={{ color: '#6366f1' }}>Tillbaka</Link></div>;

  const sports = [...new Set(courts.map(c => c.sport_type))];

  return (
    <div>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)', padding: '48px 24px', color: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Link href="/clubs" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 13, display: 'inline-block', marginBottom: 12 }}>
            ← Alla anläggningar
          </Link>
          <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 8 }}>{club.name}</h1>
          <p style={{ fontSize: 16, opacity: 0.8 }}>
            {club.city ?? 'Sverige'} · {courts.length} {courts.length === 1 ? 'bana' : 'banor'} · {sports.join(', ')}
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32, alignItems: 'start' }}>
          {/* Left: courts + description */}
          <div>
            {venue?.description && (
              <p style={{ fontSize: 15, color: '#475569', lineHeight: 1.7, marginBottom: 28 }}>{venue.description}</p>
            )}

            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Banor</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
              {courts.map(court => (
                <div key={court.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{court.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, textTransform: 'capitalize' }}>
                      {court.sport_type} · {court.is_indoor ? 'Inomhus' : 'Utomhus'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#6366f1' }}>{court.base_hourly_rate} SEK</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>per timme</div>
                  </div>
                </div>
              ))}
            </div>

            <Link href={`/clubs/${slug}/book`} style={{ display: 'inline-flex', alignItems: 'center', padding: '14px 32px', borderRadius: 12, fontSize: 16, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', textDecoration: 'none', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>
              Boka en tid
            </Link>
          </div>

          {/* Right: info sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Amenities */}
            {venue && venue.amenities.length > 0 && (
              <div style={infoCard}>
                <h3 style={infoTitle}>Faciliteter</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {venue.amenities.map(a => (
                    <span key={a} style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, background: '#f1f5f9', color: '#475569' }}>
                      {AMENITY_ICONS[a] ?? '✓'} {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Opening hours */}
            {venue && venue.opening_hours?.length > 0 && (
              <div style={infoCard}>
                <h3 style={infoTitle}>Öppettider</h3>
                {venue.opening_hours.sort((a, b) => a.day - b.day).map(oh => (
                  <div key={oh.day} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', color: '#475569' }}>
                    <span>{DAY_NAMES[oh.day]}</span>
                    <span style={{ fontWeight: 600 }}>{oh.open}–{oh.close}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Contact */}
            <div style={infoCard}>
              <h3 style={infoTitle}>Kontakt</h3>
              {club.contact_email && <p style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>{club.contact_email}</p>}
              {club.contact_phone && <p style={{ fontSize: 13, color: '#475569' }}>{club.contact_phone}</p>}
            </div>

            {/* Booking rules */}
            {venue?.booking_rules && (
              <div style={infoCard}>
                <h3 style={infoTitle}>Bokningsregler</h3>
                <p style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>
                  Boka upp till {venue.booking_rules.max_days_ahead} dagar framåt
                </p>
                <p style={{ fontSize: 13, color: '#475569' }}>
                  Avbokning senast {venue.booking_rules.cancellation_hours}h innan
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const infoCard: React.CSSProperties = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 20,
};
const infoTitle: React.CSSProperties = {
  fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#1e293b',
};
