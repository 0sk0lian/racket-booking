'use client';
/**
 * Landing page — the public entry point for players.
 * SEO-friendly, no auth required. Fetches clubs from the API for the
 * "featured clubs" section.
 */
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Club {
  id: string;
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

export default function LandingPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);

  useEffect(() => {
    fetch('/api/clubs').then(r => r.json()).then(r => setClubs(r.data ?? []));
    fetch('/api/courts').then(r => r.json()).then(r => setCourts(r.data ?? []));
  }, []);

  return (
    <div>
      {/* Hero */}
      <section style={heroStyle}>
        <div style={heroInner}>
          <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1.1, marginBottom: 16 }}>
            Boka padel & tennis<br />
            <span style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              snabbt och enkelt
            </span>
          </h1>
          <p style={{ fontSize: 18, color: '#64748b', maxWidth: 520, lineHeight: 1.6, marginBottom: 32 }}>
            Hitta lediga tider, boka bana, bjud in vänner och betala — allt på ett ställe.
            Sveriges smartaste bokningsplattform för racketsporter.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/clubs" style={heroPrimary}>Hitta en bana</Link>
            <Link href="/login" style={heroOutline}>Skapa konto</Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={sectionStyle}>
        <div style={sectionInner}>
          <h2 style={sectionTitle}>Så fungerar det</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            <StepCard step="1" title="Välj anläggning" desc="Hitta en padel- eller tennishall nära dig med lediga tider." />
            <StepCard step="2" title="Boka tid" desc="Välj bana, datum och tid som passar. Betala direkt eller dela kostnaden." />
            <StepCard step="3" title="Spela!" desc="Få PIN-kod och tillgång till banan. Vi sköter resten." />
          </div>
        </div>
      </section>

      {/* Featured clubs */}
      <section style={{ ...sectionStyle, background: '#f8fafc' }}>
        <div style={sectionInner}>
          <h2 style={sectionTitle}>Anläggningar</h2>
          {clubs.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8' }}>Laddar...</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320, 1fr))', gap: 20 }}>
              {clubs.map(club => {
                const clubCourts = courts.filter(c => c.club_id === club.id);
                const sports = [...new Set(clubCourts.map(c => c.sport_type))];
                const minPrice = clubCourts.length > 0 ? Math.min(...clubCourts.map(c => c.base_hourly_rate)) : null;
                return (
                  <Link href={`/clubs/${club.id}`} key={club.id} style={clubCardStyle}>
                    <div style={{ height: 140, background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 32, fontWeight: 800, color: 'rgba(255,255,255,0.3)' }}>
                        {club.name.charAt(0)}
                      </span>
                    </div>
                    <div style={{ padding: 20 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{club.name}</h3>
                      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>
                        {club.city ?? 'Sverige'} · {clubCourts.length} {clubCourts.length === 1 ? 'bana' : 'banor'}
                      </p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                        {sports.map(s => (
                          <span key={s} style={sportPill}>{s}</span>
                        ))}
                      </div>
                      {minPrice && (
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#6366f1' }}>
                          Från {minPrice} SEK/h
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section style={sectionStyle}>
        <div style={{ ...sectionInner, textAlign: 'center' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12 }}>Redo att spela?</h2>
          <p style={{ fontSize: 16, color: '#64748b', marginBottom: 24 }}>Skapa ett gratis konto och boka din första tid idag.</p>
          <Link href="/login" style={heroPrimary}>Kom igång — gratis</Link>
        </div>
      </section>
    </div>
  );
}

function StepCard({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 28, textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: '#eef2ff', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, margin: '0 auto 16px' }}>
        {step}
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

const heroStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #f0fdfa 100%)',
  padding: '80px 24px 60px',
};
const heroInner: React.CSSProperties = {
  maxWidth: 1200, margin: '0 auto',
};
const heroPrimary: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '14px 28px',
  borderRadius: 12, fontSize: 16, fontWeight: 700, color: '#fff',
  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
  textDecoration: 'none', boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
  transition: 'all 0.2s',
};
const heroOutline: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '14px 28px',
  borderRadius: 12, fontSize: 16, fontWeight: 700, color: '#6366f1',
  background: '#fff', border: '2px solid #e2e8f0',
  textDecoration: 'none', transition: 'all 0.2s',
};
const sectionStyle: React.CSSProperties = { padding: '64px 24px' };
const sectionInner: React.CSSProperties = { maxWidth: 1200, margin: '0 auto' };
const sectionTitle: React.CSSProperties = {
  fontSize: 28, fontWeight: 800, textAlign: 'center', marginBottom: 40, letterSpacing: -0.5,
};
const clubCardStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16,
  overflow: 'hidden', textDecoration: 'none', color: 'inherit',
  transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
};
const sportPill: React.CSSProperties = {
  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
  background: '#f1f5f9', color: '#475569', textTransform: 'capitalize',
};
