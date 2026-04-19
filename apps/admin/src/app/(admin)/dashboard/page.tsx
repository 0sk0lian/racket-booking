'use client';
/**
 * Admin Dashboard — command center with today's stats, quick actions,
 * upcoming schedule preview, and pending actions.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = '/api';

interface DashboardData {
  today: { bookings: number; trainings: number; events: number; revenue: number };
  week: { revenue: number; trend: number };
  occupancy: number;
  pending: { memberships: number; course_registrations: number; sick_leaves: number; total: number };
  active_members: number;
  expiring_memberships: number;
  upcoming_bookings: {
    id: string; type: string; court_name: string;
    time_start: string; time_end: string; booker_name: string;
  }[];
  recent_activity: {
    id: string; type: string; time: string;
    price: number; booker_name: string; created_at: string;
  }[];
}

interface Club { id: string; name: string; }

export default function DashboardPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/clubs`).then(r => r.json()).then(r => {
      setClubs(r.data ?? []);
      if (r.data?.length) setClubId(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!clubId) return;
    setLoading(true);
    fetch(`${API}/admin/dashboard?clubId=${clubId}`).then(r => r.json()).then(r => {
      setData(r.data ?? null);
      setLoading(false);
    });
  }, [clubId]);

  const h = new Date().getHours();
  const greeting = h < 12 ? 'God morgon' : h < 17 ? 'God eftermiddag' : 'God kvall';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.7, marginBottom: 4 }}>{greeting}</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>
            {new Date().toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {clubs.length > 1 && (
          <select
            value={clubId}
            onChange={e => setClubId(e.target.value)}
            style={{
              padding: '9px 16px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              fontSize: 13,
              fontFamily: 'inherit',
              background: 'var(--bg-card)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-dim)', padding: 60, textAlign: 'center', fontSize: 14 }}>
          Laddar dashboard...
        </div>
      ) : data && (
        <>
          {/* ---- Stat Cards Row ---- */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <StatCard
              label="Bokningar idag"
              value={String(data.today.bookings)}
              sub={`${data.today.trainings} traning \u00B7 ${data.today.events} event`}
              accent="#6366f1"
              iconBg="rgba(99,102,241,0.1)"
              icon={<CalendarIcon />}
            />
            <StatCard
              label="Intakter idag"
              value={`${data.today.revenue.toLocaleString('sv-SE')} kr`}
              sub={`Vecka: ${data.week.revenue.toLocaleString('sv-SE')} kr ${data.week.trend > 0 ? '\u2191' : data.week.trend < 0 ? '\u2193' : '\u2192'}${Math.abs(data.week.trend)}%`}
              accent="#10b981"
              iconBg="rgba(16,185,129,0.1)"
              icon={<RevenueIcon />}
            />
            <StatCard
              label="Vantande medlemskap"
              value={String(data.pending.memberships)}
              sub={data.pending.memberships > 0 ? 'Kräver atgard' : 'Inga vantande'}
              accent={data.pending.memberships > 0 ? '#f59e0b' : '#10b981'}
              iconBg={data.pending.memberships > 0 ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)'}
              icon={<PendingIcon />}
            />
            <StatCard
              label="Aktiva medlemmar"
              value={String(data.active_members)}
              sub={`${data.occupancy}% belaggning idag`}
              accent="#0ea5e9"
              iconBg="rgba(14,165,233,0.1)"
              icon={<MembersIcon />}
            />
          </div>

          {/* ---- Quick Actions ---- */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '16px 20px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginRight: 4 }}>
              Snabbatgarder
            </span>
            <QuickAction href="/schedule" label="Nytt pass" color="#6366f1" />
            <QuickAction href="/schedule?view=day" label="Ny bokning" color="#06b6d4" />
            <QuickAction href="/admin/memberships" label="Hantera vantande" color="#f59e0b" />
          </div>

          {/* ---- Expiring Memberships Warning ---- */}
          {data.expiring_memberships > 0 && (
            <div style={{
              background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 14,
              padding: '14px 20px',
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <span style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(245,158,11,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#b45309' }}>
                  {data.expiring_memberships} medlemskap gar ut inom 7 dagar
                </div>
                <div style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>
                  Kontakta medlemmarna for att fornya deras medlemskap.
                </div>
              </div>
              <Link href="/admin/memberships" style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: '#f59e0b', color: '#fff', textDecoration: 'none',
              }}>
                Visa
              </Link>
            </div>
          )}

          {/* ---- Two-column: Upcoming Schedule + Pending / Recent ---- */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Today's Schedule Preview */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 20,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700 }}>Kommande idag</h2>
                <Link href="/schedule" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                  Visa alla &rarr;
                </Link>
              </div>
              {data.upcoming_bookings.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
                  Inga fler bokningar idag.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {data.upcoming_bookings.map(b => {
                    const startTime = new Date(b.time_start).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
                    const endTime = new Date(b.time_end).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={b.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        background: 'var(--bg-body)',
                        borderRadius: 10,
                        transition: 'background 0.15s',
                      }}>
                        <div style={{
                          width: 4,
                          height: 36,
                          borderRadius: 2,
                          background: typeColor(b.type),
                          flexShrink: 0,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                            {b.booker_name}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                            {b.court_name} &middot; {startTime}&ndash;{endTime}
                          </div>
                        </div>
                        <TypeBadge type={b.type} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right column: Pending + Recent Activity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Pending Actions */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: 20,
              }}>
                <h2 style={{
                  fontSize: 15,
                  fontWeight: 700,
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  Behöver uppmärksamhet
                  {data.pending.total > 0 && (
                    <span style={{
                      background: '#ef4444',
                      color: '#fff',
                      borderRadius: 10,
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      {data.pending.total}
                    </span>
                  )}
                </h2>
                {data.pending.total === 0 ? (
                  <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Allt under kontroll!</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {data.pending.memberships > 0 && (
                      <PendingItem href="/admin/memberships" color="#f59e0b" label={`${data.pending.memberships} vantande medlemsansokningar`} />
                    )}
                    {data.pending.course_registrations > 0 && (
                      <PendingItem href="/courses" color="#6366f1" label={`${data.pending.course_registrations} vantande kursanmalningar`} />
                    )}
                    {data.pending.sick_leaves > 0 && (
                      <PendingItem href="/sick-leave" color="#dc2626" label={`${data.pending.sick_leaves} aktiva sjukanmalningar`} />
                    )}
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: 20,
              }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Senaste aktivitet</h2>
                {data.recent_activity.length === 0 ? (
                  <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Inga bokningar annu.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {data.recent_activity.map(a => (
                      <div key={a.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'var(--bg-body)',
                        borderRadius: 8,
                        fontSize: 13,
                      }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
                          <TypeBadge type={a.type} />
                          <span style={{ fontWeight: 500 }}>{a.booker_name}</span>
                          <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                            {a.time ? new Date(a.time).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) + ' ' + new Date(a.time).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <span style={{ fontWeight: 600, color: '#10b981', flexShrink: 0 }}>
                          {a.price?.toLocaleString('sv-SE') ?? 0} kr
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---- Sub-components ----

function StatCard({ label, value, sub, accent, iconBg, icon }: {
  label: string; value: string; sub: string; accent: string;
  iconBg: string; icon: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-xs)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          {label}
        </div>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent, letterSpacing: -1, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>{sub}</div>
      {/* Subtle accent gradient at bottom */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 3,
        background: `linear-gradient(90deg, ${accent}, transparent)`,
        opacity: 0.4,
      }} />
    </div>
  );
}

function QuickAction({ href, label, color }: { href: string; label: string; color: string }) {
  return (
    <Link href={href} style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 16px',
      borderRadius: 8,
      background: `${color}10`,
      color,
      fontSize: 13,
      fontWeight: 600,
      textDecoration: 'none',
      transition: 'all 0.15s',
      border: `1px solid ${color}20`,
    }}>
      <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
      {label}
    </Link>
  );
}

function PendingItem({ href, color, label }: { href: string; color: string; label: string }) {
  return (
    <Link href={href} style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 14px',
      background: 'var(--bg-body)',
      borderRadius: 8,
      textDecoration: 'none',
      color: 'inherit',
      transition: 'background 0.15s',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>&rarr;</span>
    </Link>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    regular: { bg: '#ecfdf5', color: '#059669' },
    training: { bg: '#eef2ff', color: '#4f46e5' },
    contract: { bg: '#fef3c7', color: '#b45309' },
    event: { bg: '#fce7f3', color: '#be185d' },
  };
  const c = colors[type] ?? colors.regular;
  return (
    <span style={{
      padding: '2px 8px',
      borderRadius: 8,
      fontSize: 10,
      fontWeight: 600,
      background: c.bg,
      color: c.color,
      textTransform: 'capitalize',
      flexShrink: 0,
    }}>
      {type}
    </span>
  );
}

function typeColor(type: string): string {
  const map: Record<string, string> = {
    regular: '#10b981',
    training: '#6366f1',
    contract: '#f59e0b',
    event: '#ec4899',
  };
  return map[type] ?? '#10b981';
}

// ---- Inline SVG icons (16x16) ----

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function RevenueIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function MembersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
