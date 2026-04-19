'use client';
/**
 * Smart Dashboard — admin command center.
 * Today's metrics, revenue trend, occupancy, pending actions, recent activity.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';

const API = '/api';

interface DashboardData {
  today: { bookings: number; trainings: number; events: number; revenue: number };
  week: { revenue: number; trend: number };
  occupancy: number;
  pending: { memberships: number; course_registrations: number; sick_leaves: number; total: number };
  recent_activity: { id: string; type: string; time: string; price: number; booker_name: string; created_at: string }[];
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
  const greeting = h < 12 ? 'God morgon' : h < 17 ? 'God eftermiddag' : 'God kväll';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{greeting}</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 4 }}>
            {new Date().toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        {clubs.length > 1 && (
          <select value={clubId} onChange={e => setClubId(e.target.value)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, fontFamily: 'inherit' }}>
            {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {loading ? <div className="loading">Laddar dashboard...</div> : data && (
        <>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <MetricCard
              label="Idag"
              value={String(data.today.bookings)}
              sub={`${data.today.trainings} träning · ${data.today.events} event`}
              color="#6366f1"
            />
            <MetricCard
              label="Intäkter idag"
              value={`${data.today.revenue.toFixed(0)}`}
              sub="SEK"
              color="#10b981"
            />
            <MetricCard
              label="Veckotrend"
              value={`${data.week.revenue.toFixed(0)}`}
              sub={`SEK · ${data.week.trend > 0 ? '↑' : data.week.trend < 0 ? '↓' : '→'} ${Math.abs(data.week.trend)}% vs förra veckan`}
              color={data.week.trend >= 0 ? '#10b981' : '#ef4444'}
            />
            <MetricCard
              label="Beläggning"
              value={`${data.occupancy}%`}
              sub="av dagens kapacitet"
              color={data.occupancy >= 70 ? '#10b981' : data.occupancy >= 40 ? '#f59e0b' : '#ef4444'}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            {/* Pending actions */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                Behöver uppmärksamhet
                {data.pending.total > 0 && <span style={{ background: '#ef4444', color: '#fff', borderRadius: 10, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{data.pending.total}</span>}
              </h2>
              {data.pending.total === 0 ? (
                <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Allt under kontroll!</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.pending.memberships > 0 && (
                    <ActionItem href="/admin/memberships" color="#f59e0b" label={`${data.pending.memberships} väntande medlemsansökningar`} />
                  )}
                  {data.pending.course_registrations > 0 && (
                    <ActionItem href="/courses" color="#6366f1" label={`${data.pending.course_registrations} väntande kursanmälningar`} />
                  )}
                  {data.pending.sick_leaves > 0 && (
                    <ActionItem href="/sick-leave" color="#dc2626" label={`${data.pending.sick_leaves} aktiva sjukanmälningar`} />
                  )}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Snabbåtgärder</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <QuickLink href="/schedule" icon="📅" label="Schema" />
                <QuickLink href="/training-planner" icon="🏋️" label="Träningsplanerare" />
                <QuickLink href="/courses" icon="📚" label="Kurser" />
                <QuickLink href="/admin/blackouts" icon="🚧" label="Stängningar" />
                <QuickLink href="/users" icon="👥" label="Spelare" />
                <QuickLink href="/admin/trainers" icon="🎾" label="Tränare" />
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Senaste aktivitet</h2>
            {data.recent_activity.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Inga bokningar ännu.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.recent_activity.map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-body)', borderRadius: 8, fontSize: 13 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <TypeBadge type={a.type} />
                      <span style={{ fontWeight: 500 }}>{a.booker_name}</span>
                      <span style={{ color: 'var(--text-dim)' }}>
                        {a.time ? new Date(a.time).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) + ' ' + new Date(a.time).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <span style={{ fontWeight: 600, color: '#10b981' }}>{a.price?.toFixed(0) ?? 0} SEK</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, letterSpacing: -1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function ActionItem({ href, color, label }: { href: string; color: string; label: string }) {
  return (
    <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg-body)', borderRadius: 8, textDecoration: 'none', color: 'inherit', transition: 'background 0.15s' }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
      <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-dim)' }}>→</span>
    </Link>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--bg-body)', borderRadius: 8, textDecoration: 'none', color: 'inherit', fontSize: 13, fontWeight: 500, transition: 'background 0.15s' }}>
      <span style={{ fontSize: 16 }}>{icon}</span>{label}
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
  return <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: c.bg, color: c.color, textTransform: 'capitalize' }}>{type}</span>;
}
