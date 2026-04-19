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

  const loadInitial = async () => {
    setLoading(true);

    const [clubsResponse, courtsResponse, meResponse] = await Promise.all([
      fetch(`${API}/clubs`).then((r) => r.json()),
      fetch(`${API}/courts?clubId=${id}`).then((r) => r.json()),
      fetch(`${API}/users/me`).then((r) => r.json()),
    ]);

    setClub((clubsResponse.data ?? []).find((row: any) => row.id === id) ?? null);
    setCourts(courtsResponse.data ?? []);

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

    if (!response.success) return setToast(response.error ?? 'Could not assign admin');

    setSelectedUserId('');
    await loadAssignments();
    setToast('Admin assigned to venue');
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

    if (!response.success) return setToast(response.error ?? 'Could not invite admin');

    if (response.data?.tempPassword) {
      setInviteResult({ tempPassword: response.data.tempPassword, email: response.data.email });
    } else {
      setToast(`${response.data.email} assigned as ${inviteRole}`);
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

    if (!response.success) return setToast(response.error ?? 'Could not remove assignment');

    await loadAssignments();
    setToast('Admin removed from venue');
  };

  const deleteClub = async () => {
    if (!window.confirm('Delete this venue? This cannot be undone.')) return;

    setDeletingClub(true);
    const response = await fetch(`${API}/clubs/${id}`, { method: 'DELETE' }).then((r) => r.json());
    setDeletingClub(false);

    if (!response.success) return setToast(response.error ?? 'Could not delete venue');
    router.push('/admin/manage-clubs');
  };

  if (loading) return <div className="loading">Loading...</div>;

  if (!club) {
    return (
      <div className="empty-state">
        <h3>Venue not found</h3>
        <Link href="/admin/manage-clubs" style={{ color: '#6366f1' }}>
          Back
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/admin/manage-clubs" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 12 }}>
            Back to venues
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
            {deletingClub ? 'Deleting...' : 'Delete venue'}
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <InfoCard label="Org number" value={club.organization_number ?? '-'} />
        <InfoCard label="City" value={club.city ?? '-'} />
        <InfoCard label="Email" value={club.contact_email ?? '-'} />
        <InfoCard label="Phone" value={club.contact_phone ?? '-'} />
        <InfoCard label="Type" value={club.is_non_profit ? 'Non-profit' : 'Commercial'} />
        <InfoCard label="Timezone" value={club.timezone ?? 'Europe/Stockholm'} />
      </div>

      {meRole === 'superadmin' && (
        <div style={{ marginBottom: 22 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>Tenant Admins</h2>
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
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                </select>
                <button onClick={inviteByEmail} disabled={!inviteEmail.trim() || busy} className="btn btn-primary">
                  {busy ? '...' : 'Invite'}
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
                <option value="">Select user</option>
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
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>

              <button onClick={assignUser} disabled={!selectedUserId || busy} className="btn btn-primary">
                Assign
              </button>
            </div>

            {assignments.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>No assigned admins for this venue yet.</p>
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
                        {row.user_email ?? '-'} | platform role: {row.user_role ?? '-'}
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
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>Courts ({courts.length})</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {courts.map((court) => (
          <div
            key={court.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '12px 16px',
            }}
          >
            <div>
              <span style={{ fontWeight: 600 }}>{court.name}</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 12, marginLeft: 8, textTransform: 'capitalize' }}>
                {court.sport_type} | {court.is_indoor ? 'Indoor' : 'Outdoor'}
              </span>
            </div>
            <span style={{ fontWeight: 600, color: '#6366f1' }}>{court.base_hourly_rate} SEK/h</span>
          </div>
        ))}
      </div>
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
