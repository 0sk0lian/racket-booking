'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const API = '/api';

interface AssignmentRow {
  club_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'staff';
  user_name: string;
  user_email: string | null;
  user_role: string | null;
}

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export default function ClubDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [club, setClub] = useState<any>(null);
  const [courts, setCourts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [meRole, setMeRole] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'owner' | 'admin' | 'staff'>('admin');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'owner' | 'admin' | 'staff'>('admin');
  const [inviteResult, setInviteResult] = useState<{ tempPassword?: string; email?: string } | null>(null);

  const [membershipTypes, setMembershipTypes] = useState<any[]>([]);
  const [newType, setNewType] = useState({ name: '', description: '', price: '', interval: 'month' });

  const [activeTab, setActiveTab] = useState<'overview' | 'courts' | 'memberships' | 'admins'>('overview');

  const [busy, setBusy] = useState(false);
  const [deletingClub, setDeletingClub] = useState(false);
  const [flash, setFlash] = useState('');

  const setToast = (message: string) => {
    setFlash(message);
    setTimeout(() => setFlash(''), 3500);
  };

  const loadAssignments = async () => {
    const response = await fetch(`${API}/admin/club-admins?clubId=${id}`).then((r) => r.json());
    setAssignments(response.data ?? []);
  };

  const loadMembershipTypes = async () => {
    const response = await fetch(`${API}/membership-types?clubId=${id}`).then((r) => r.json());
    setMembershipTypes(response.data ?? []);
  };

  const loadInitial = async () => {
    setLoading(true);

    const [clubsResponse, courtsResponse, meResponse, typesResponse] = await Promise.all([
      fetch(`${API}/clubs`).then((r) => r.json()),
      fetch(`${API}/courts?clubId=${id}`).then((r) => r.json()),
      fetch(`${API}/users/me`).then((r) => r.json()),
      fetch(`${API}/membership-types?clubId=${id}`).then((r) => r.json()),
    ]);

    setClub((clubsResponse.data ?? []).find((row: any) => row.id === id) ?? null);
    setCourts(courtsResponse.data ?? []);
    setMembershipTypes(typesResponse.data ?? []);

    const role = meResponse?.data?.role ?? null;
    setMeRole(role);

    if (role === 'superadmin') {
      const [assignmentResponse, usersResponse] = await Promise.all([
        fetch(`${API}/admin/club-admins?clubId=${id}`).then((r) => r.json()),
        fetch(`${API}/users`).then((r) => r.json()),
      ]);

      setAssignments(assignmentResponse.data ?? []);
      setUsers((usersResponse.data ?? []).filter((user: UserRow) => user.role !== 'superadmin'));
    }

    setLoading(false);
  };

  useEffect(() => {
    void loadInitial();
  }, [id]);

  const assignedIds = useMemo(() => new Set(assignments.map((row) => row.user_id)), [assignments]);
  const unassignedUsers = useMemo(
    () => users.filter((user) => !assignedIds.has(user.id)),
    [users, assignedIds],
  );

  const assignUser = async () => {
    if (!selectedUserId) return;

    setBusy(true);
    const response = await fetch(`${API}/admin/club-admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId: id, userId: selectedUserId, role: selectedRole }),
    }).then((r) => r.json());
    setBusy(false);

    if (!response.success) return setToast(response.error ?? 'Kunde inte tilldela admin');

    setSelectedUserId('');
    await loadAssignments();
    setToast('Admin tilldelad till anläggningen');
  };

  const inviteByEmail = async () => {
    if (!inviteEmail.trim()) return;
    setBusy(true);
    setInviteResult(null);

    const response = await fetch(`${API}/admin/invite-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail.trim(), clubId: id, role: inviteRole }),
    }).then((r) => r.json());
    setBusy(false);

    if (!response.success) return setToast(response.error ?? 'Kunde inte bjuda in admin');

    if (response.data?.tempPassword) {
      setInviteResult({ tempPassword: response.data.tempPassword, email: response.data.email });
    } else {
      setToast(`${response.data.email} tilldelades som ${inviteRole}`);
    }

    setInviteEmail('');
    await loadAssignments();
  };

  const removeUser = async (userId: string) => {
    setBusy(true);
    const response = await fetch(`${API}/admin/club-admins`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId: id, userId }),
    }).then((r) => r.json());
    setBusy(false);

    if (!response.success) return setToast(response.error ?? 'Kunde inte ta bort tilldelningen');

    await loadAssignments();
    setToast('Admin borttagen från anläggningen');
  };

  const createMembershipType = async () => {
    if (!newType.name.trim()) return;
    setBusy(true);
    const response = await fetch(`${API}/membership-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clubId: id,
        name: newType.name.trim(),
        description: newType.description || null,
        price: newType.price ? Number(newType.price) : 0,
        interval: newType.interval,
      }),
    }).then((r) => r.json());
    setBusy(false);
    if (!response.success) return setToast(response.error ?? 'Kunde inte skapa medlemskapstyp');
    setNewType({ name: '', description: '', price: '', interval: 'month' });
    await loadMembershipTypes();
    setToast('Medlemskapstyp skapad');
  };

  const deleteMembershipType = async (typeId: string) => {
    setBusy(true);
    const response = await fetch(`${API}/membership-types?id=${typeId}`, { method: 'DELETE' }).then((r) => r.json());
    setBusy(false);
    if (!response.success) return setToast(response.error ?? 'Kunde inte ta bort');
    await loadMembershipTypes();
    setToast('Medlemskapstyp borttagen');
  };

  const deleteClub = async () => {
    if (!window.confirm('Ta bort den här anläggningen? Det går inte att ångra.')) return;

    setDeletingClub(true);
    const response = await fetch(`${API}/clubs/${id}`, { method: 'DELETE' }).then((r) => r.json());
    setDeletingClub(false);

    if (!response.success) return setToast(response.error ?? 'Kunde inte ta bort anläggningen');
    router.push('/admin/manage-clubs');
  };

  if (loading) return <div className="loading">Laddar...</div>;

  if (!club) {
    return (
      <div className="empty-state">
        <h3>Anläggningen hittades inte</h3>
        <Link href="/admin/manage-clubs" style={{ color: '#6366f1' }}>
          Tillbaka
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/admin/manage-clubs" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 12 }}>
            Tillbaka till anläggningar
          </Link>
          <h1 style={{ marginTop: 4 }}>{club.name}</h1>
        </div>
        {meRole === 'superadmin' && (
          <button
            className="btn btn-outline"
            onClick={deleteClub}
            disabled={deletingClub}
            style={{ borderColor: '#ef4444', color: '#ef4444' }}
          >
            {deletingClub ? 'Tar bort...' : 'Ta bort anläggning'}
          </button>
        )}
      </div>

      {flash && (
        <div
          style={{
            marginBottom: 12,
            borderRadius: 10,
            border: '1px solid #cbd5e1',
            background: '#f8fafc',
            color: '#334155',
            fontSize: 12,
            fontWeight: 600,
            padding: '10px 14px',
          }}
        >
          {flash}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {([
          { key: 'overview', label: 'Översikt' },
          { key: 'courts', label: `Banor (${courts.length})` },
          { key: 'memberships', label: `Medlemskap (${membershipTypes.length})` },
          ...(meRole === 'superadmin' ? [{ key: 'admins', label: `Admins (${assignments.length})` }] : []),
        ] as { key: typeof activeTab; label: string }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 600 : 500,
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-muted)',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* === ÖVERSIKT === */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <InfoCard label="Org.nr" value={club.organization_number ?? '-'} />
          <InfoCard label="Stad" value={club.city ?? '-'} />
          <InfoCard label="E-post" value={club.contact_email ?? '-'} />
          <InfoCard label="Telefon" value={club.contact_phone ?? '-'} />
          <InfoCard label="Typ" value={club.is_non_profit ? 'Ideell' : 'Kommersiell'} />
          <InfoCard label="Tidszon" value={club.timezone ?? 'Europe/Stockholm'} />
        </div>
      )}

      {/* === ADMINS === */}
      {activeTab === 'admins' && meRole === 'superadmin' && (
        <div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
            {/* Invite by email */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Bjud in via e-post</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px auto', gap: 8, alignItems: 'center' }}>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="admin@example.com"
                  type="email"
                  style={inputStyle}
                />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)} style={inputStyle}>
                  <option value="owner">Ägare</option>
                  <option value="admin">Admin</option>
                  <option value="staff">Personal</option>
                </select>
                <button onClick={inviteByEmail} disabled={!inviteEmail.trim() || busy} className="btn btn-primary">
                  {busy ? '...' : 'Bjud in'}
                </button>
              </div>
            </div>

            {inviteResult?.tempPassword && (
              <div style={{ marginBottom: 14, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 4 }}>Konto skapat</div>
                <div style={{ fontSize: 12, color: '#15803d' }}>
                  E-post: <strong>{inviteResult.email}</strong>
                </div>
                <div style={{ fontSize: 12, color: '#15803d', marginBottom: 6 }}>
                  Engångslösenord: <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: 4, fontWeight: 700, fontSize: 14 }}>{inviteResult.tempPassword}</code>
                </div>
                <div style={{ fontSize: 11, color: '#166534' }}>Skicka detta till adminen. De måste byta lösenord vid första inloggningen.</div>
                <button onClick={() => setInviteResult(null)} style={{ marginTop: 6, fontSize: 11, color: '#166534', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Stäng</button>
              </div>
            )}

            {/* Assign existing user */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Eller tilldela befintlig användare</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px auto', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} style={inputStyle}>
                <option value="">Välj användare</option>
                {unassignedUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.email})
                  </option>
                ))}
              </select>

              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as 'owner' | 'admin' | 'staff')}
                style={inputStyle}
              >
                <option value="owner">Ägare</option>
                <option value="admin">Admin</option>
                <option value="staff">Personal</option>
              </select>

              <button onClick={assignUser} disabled={!selectedUserId || busy} className="btn btn-primary">
                Tilldela
              </button>
            </div>

            {assignments.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Inga admins är tilldelade till den här anläggningen ännu.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {assignments.map((row) => (
                  <div
                    key={`${row.club_id}_${row.user_id}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: '10px 12px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{row.user_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {row.user_email ?? '-'} | plattformsroll: {row.user_role ?? '-'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge badge-blue">{row.role}</span>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '4px 10px', fontSize: 11 }}
                        onClick={() => removeUser(row.user_id)}
                        disabled={busy}
                      >
                        Ta bort
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === MEDLEMSKAP === */}
      {activeTab === 'memberships' && (
        <div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Skapa ny typ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px 130px auto', gap: 8, alignItems: 'center', marginBottom: 14 }}>
              <input value={newType.name} onChange={(e) => setNewType((p) => ({ ...p, name: e.target.value }))} placeholder="Namn (t.ex. Guld)" style={inputStyle} />
              <input value={newType.description} onChange={(e) => setNewType((p) => ({ ...p, description: e.target.value }))} placeholder="Beskrivning" style={inputStyle} />
              <input value={newType.price} onChange={(e) => setNewType((p) => ({ ...p, price: e.target.value }))} placeholder="Pris" type="number" min="0" style={inputStyle} />
              <select value={newType.interval} onChange={(e) => setNewType((p) => ({ ...p, interval: e.target.value }))} style={inputStyle}>
                <option value="month">Per månad</option>
                <option value="quarter">Per kvartal</option>
                <option value="half_year">Per halvår</option>
                <option value="year">Per år</option>
                <option value="once">Engångs</option>
              </select>
              <button onClick={createMembershipType} disabled={busy || !newType.name.trim()} className="btn btn-primary">Skapa</button>
            </div>

            {membershipTypes.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>Inga medlemskapstyper skapade ännu.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {membershipTypes.map((mt) => (
                  <div key={mt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{mt.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {mt.description ?? ''}{mt.description ? ' | ' : ''}
                        {mt.price > 0 ? `${mt.price} ${mt.currency}` : 'Gratis'}{' / '}
                        {{ month: 'månad', quarter: 'kvartal', half_year: 'halvår', year: 'år', once: 'engångs' }[mt.interval as string] ?? mt.interval}
                      </div>
                    </div>
                    <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 11, borderColor: '#ef4444', color: '#ef4444' }} onClick={() => deleteMembershipType(mt.id)} disabled={busy}>Ta bort</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === BANOR === */}
      {activeTab === 'courts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {courts.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-dim)', padding: 20, textAlign: 'center' }}>Inga banor tillagda ännu.</p>
          ) : courts.map((court) => (
            <div key={court.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
              <div>
                <span style={{ fontWeight: 600 }}>{court.name}</span>
                <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 8, textTransform: 'capitalize' }}>{court.sport_type} | {court.is_indoor ? 'Inomhus' : 'Utomhus'}</span>
              </div>
              <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{court.base_hourly_rate} SEK/h</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  fontSize: 12,
  fontFamily: 'inherit',
};
