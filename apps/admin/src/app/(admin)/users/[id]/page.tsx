'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

type Membership = {
  id: string;
  club_id: string;
  club_name: string;
  status: string;
  membership_type: string;
  payment_status: string;
  applied_at: string | null;
  invoice_id: string | null;
  form_answers: Record<string, unknown>;
};

type Group = {
  id: string;
  name: string;
  category: string;
  parent_name: string | null;
};

type Session = {
  id: string;
  title: string;
  day_name: string;
  start_hour: number;
  end_hour: number;
  trainer_name: string;
  court_name: string;
  status: string;
  applied_count: number;
};

type Submission = {
  form_title: string;
  submitted_at: string;
};

type PlayerDetail = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  role: string;
  is_active: boolean;
  age: number | null;
  social_number: string | null;
  membership_type: string | null;
  memberships: Membership[];
  groups: Group[];
  sessions: Session[];
  submissions: Submission[];
  bookingCount: number;
};

export default function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const clubId = searchParams.get('clubId');
  const [data, setData] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const query = clubId ? `?clubId=${encodeURIComponent(clubId)}` : '';

    setLoading(true);
    setError('');

    fetch(`/api/features/player-detail/${id}${query}`)
      .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
      .then(({ ok, body }) => {
        if (!active) return;
        if (!ok || !body.success) {
          setError(body.error ?? 'Kunde inte ladda medlemsprofilen');
          setData(null);
          setLoading(false);
          return;
        }
        setData(body.data ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError('Kunde inte ladda medlemsprofilen');
        setData(null);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [clubId, id]);

  if (loading) return <div className="loading">Laddar medlemsprofil...</div>;
  if (error) return <div className="empty-state">{error}</div>;
  if (!data) return <div className="empty-state">Medlemmen hittades inte</div>;

  const activeMembership = data.memberships.find((membership) => membership.status === 'active') ?? data.memberships[0] ?? null;
  const membershipForms = data.memberships.filter((membership) => Object.keys(membership.form_answers ?? {}).length > 0);

  return (
    <div>
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <Link href="/users" style={{ fontSize: 13, color: 'var(--text-dim)' }}>← Tillbaka till medlemmar</Link>
          <h1 style={{ marginTop: 8 }}>{data.full_name}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
            <span className={`badge ${data.is_active ? 'badge-green' : 'badge-red'}`}>{data.is_active ? 'Aktivt konto' : 'Inaktivt konto'}</span>
            <span className={`badge ${data.role === 'trainer' ? 'badge-blue' : data.role === 'admin' || data.role === 'superadmin' ? 'badge-yellow' : 'badge-green'}`}>{({ player: 'Spelare', trainer: 'Tränare', admin: 'Admin', superadmin: 'Superadmin' } as Record<string, string>)[data.role] ?? data.role}</span>
            {activeMembership && <span className="badge badge-blue">{activeMembership.membership_type}</span>}
          </div>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <StatCard label="Medlemskap" value={String(data.memberships.length)} accent="#6366f1" />
        <StatCard label="Grupper" value={String(data.groups.length)} accent="#06b6d4" />
        <StatCard label="Pass" value={String(data.sessions.length)} accent="#10b981" />
        <StatCard label="Bokningar" value={String(data.bookingCount)} accent="#f59e0b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 20 }}>
        <section style={cardStyle}>
          <h2 style={sectionTitle}>Medlemsuppgifter</h2>
          <div style={kvGrid}>
            <KeyValue label="Namn" value={data.full_name} />
            <KeyValue label="E-post" value={data.email} />
            <KeyValue label="Telefon" value={data.phone_number || 'Ej angivet'} />
            <KeyValue label="Ålder" value={data.age != null ? String(data.age) : 'Ej angivet'} />
            <KeyValue label="Personnummer" value={data.social_number || 'Ej angivet'} />
            <KeyValue label="Nuvarande medlemskap" value={data.membership_type || 'Ej angivet'} />
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitle}>Grupper</h2>
          {data.groups.length === 0 ? (
            <Empty text="Inga grupper tilldelade." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.groups.map((group) => (
                <div key={group.id} style={pillRow}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{group.name}</div>
                    {group.parent_name && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Förälder: {group.parent_name}</div>}
                  </div>
                  <span className={`badge ${group.category === 'junior' ? 'badge-blue' : group.category === 'adult' ? 'badge-green' : 'badge-yellow'}`}>{group.category}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <section style={cardStyle}>
          <h2 style={sectionTitle}>Medlemskap</h2>
          {data.memberships.length === 0 ? (
            <Empty text="Inga medlemskap hittades." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.memberships.map((membership) => (
                <div key={membership.id} style={listRow}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{membership.club_name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                      {membership.membership_type} · Ansökte {formatDate(membership.applied_at)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div><span className={`badge ${membership.status === 'active' ? 'badge-green' : membership.status === 'pending' ? 'badge-yellow' : 'badge-red'}`}>{({ active: 'Aktiv', pending: 'Väntande', approved: 'Godkänd', suspended: 'Pausad', rejected: 'Avslagen', cancelled: 'Avslutad' } as Record<string, string>)[membership.status] ?? membership.status}</span></div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>Betalning: {({ paid: 'Betald', unpaid: 'Obetald', refunded: 'Återbetald' } as Record<string, string>)[membership.payment_status] ?? membership.payment_status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitle}>Formulär och ansökningar</h2>
          {data.submissions.length === 0 ? (
            <Empty text="Inga inskickade formulär." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.submissions.map((submission, index) => (
                <div key={`${submission.form_title}-${submission.submitted_at}-${index}`} style={listRow}>
                  <div style={{ fontWeight: 700 }}>{submission.form_title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{formatDateTime(submission.submitted_at)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section style={{ ...cardStyle, marginBottom: 20 }}>
        <h2 style={sectionTitle}>Pass</h2>
        {data.sessions.length === 0 ? (
          <Empty text="Inga pass tilldelade." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pass</th>
                  <th>Tid</th>
                  <th>Bana</th>
                  <th>Tränare</th>
                  <th>Status</th>
                  <th>Anmälda</th>
                </tr>
              </thead>
              <tbody>
                {data.sessions.map((session) => (
                  <tr key={session.id}>
                    <td style={{ fontWeight: 700 }}>{session.title}</td>
                    <td>{session.day_name} {String(session.start_hour).padStart(2, '0')}:00-{String(session.end_hour).padStart(2, '0')}:00</td>
                    <td>{session.court_name}</td>
                    <td>{session.trainer_name}</td>
                    <td><span className="badge badge-blue">{({ scheduled: 'Schemalagd', confirmed: 'Bekräftad', pending: 'Väntande', cancelled: 'Avbokad', completed: 'Avslutad' } as Record<string, string>)[session.status] ?? session.status}</span></td>
                    <td>{session.applied_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 style={sectionTitle}>Formulärsvar</h2>
        {membershipForms.length === 0 ? (
          <Empty text="Inga sparade medlemsformulärsvar." />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {membershipForms.map((membership) => (
              <div key={`answers-${membership.id}`} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>{membership.club_name} · {membership.membership_type}</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {Object.entries(membership.form_answers).map(([key, value]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 13 }}>
                      <span style={{ color: 'var(--text-dim)' }}>{key.replace(/_/g, ' ')}</span>
                      <span style={{ fontWeight: 600, textAlign: 'right' }}>{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
      <span style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ padding: 18, color: 'var(--text-dim)', textAlign: 'center' }}>{text}</div>;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('sv-SE');
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('sv-SE');
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: 20,
  boxShadow: 'var(--shadow-sm)',
};

const sectionTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  marginBottom: 14,
};

const kvGrid: React.CSSProperties = {
  display: 'grid',
  gap: 10,
};

const listRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'center',
  padding: '12px 14px',
  borderRadius: 12,
  background: 'var(--bg-body)',
};

const pillRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  alignItems: 'center',
  padding: '12px 14px',
  borderRadius: 12,
  background: 'var(--bg-body)',
};
