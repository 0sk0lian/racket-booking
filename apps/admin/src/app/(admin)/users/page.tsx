'use client';

import type { CSSProperties } from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const API = '/api';

interface PlayerDetail {
  id: string;
  full_name: string;
  email: string;
  age: number | null;
  social_number: string | null;
  membership_type: string | null;
  memberships: { club_id: string; club_name: string; status: string; membership_type: string }[];
  groups: { id: string; name: string; category: string; parent_name: string | null }[];
  sessions: {
    id: string;
    title: string;
    day_of_week: number;
    day_name: string;
    start_hour: number;
    end_hour: number;
    status: string;
    trainer_name: string;
    court_name: string;
    applied_count: number;
  }[];
  submissions: { form_title: string; submitted_at: string }[];
  bookingCount: number;
}

export default function UsersPage() {
  const [clubs, setClubs] = useState<any[]>([]);
  const [clubId, setClubId] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [lbPadel, setLbPadel] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'player' | 'trainer' | 'admin' | 'superadmin'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [editBusy, setEditBusy] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  const updateUser = async (userId: string, updates: Record<string, unknown>) => {
    setEditBusy(true);
    const res = await fetch(`${API}/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).then(r => r.json());
    setEditBusy(false);
    if (!res.success) { flash(res.error ?? 'Could not update'); return false; }
    flash('Updated');
    // Refresh user list + detail
    const listRes = await fetch(`${API}/users?clubId=${clubId}`).then(r => r.json());
    setUsers(listRes.data || []);
    if (expandedId === userId) {
      const detailRes = await fetch(`${API}/features/player-detail/${userId}?clubId=${clubId}`).then(r => r.json());
      setDetail(detailRes.data);
    }
    return true;
  };

  const updateMembership = async (membershipId: string, status: string) => {
    setEditBusy(true);
    await fetch(`${API}/admin/memberships`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: membershipId, status }),
    });
    setEditBusy(false);
    flash(`Membership ${status}`);
    if (expandedId) {
      const detailRes = await fetch(`${API}/features/player-detail/${expandedId}?clubId=${clubId}`).then(r => r.json());
      setDetail(detailRes.data);
    }
  };

  const removeMembership = async (membershipId: string) => {
    if (!confirm('Ta bort denna medlem från klubben? Detta kan inte ångras.')) return;
    setEditBusy(true);
    await fetch(`${API}/admin/memberships?id=${membershipId}`, { method: 'DELETE' });
    setEditBusy(false);
    flash('Medlem borttagen från klubb');
    if (expandedId) {
      const detailRes = await fetch(`${API}/features/player-detail/${expandedId}?clubId=${clubId}`).then(r => r.json());
      setDetail(detailRes.data);
    }
  };

  const deactivateAccount = async (userId: string) => {
    if (!confirm('Deaktivera detta konto? Användaren kommer inte kunna logga in.')) return;
    setEditBusy(true);
    await fetch(`${API}/users/${userId}`, { method: 'DELETE' });
    setEditBusy(false);
    flash('Konto deaktiverat');
    const listRes = await fetch(`${API}/users?clubId=${clubId}`).then(r => r.json());
    setUsers(listRes.data || []);
    setExpandedId(null);
    setDetail(null);
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API}/clubs`).then((r) => r.json()),
      fetch(`${API}/users/leaderboard?sport=padel`).then((r) => r.json()),
    ]).then(([clubsResponse, leaderboardResponse]) => {
      const loadedClubs = clubsResponse.data ?? [];
      setClubs(loadedClubs);
      if (loadedClubs.length > 0) setClubId(loadedClubs[0].id);
      else setLoading(false);
      setLbPadel(leaderboardResponse.data || []);
    });
  }, []);

  useEffect(() => {
    if (!clubId) return;
    setExpandedId(null);
    setDetail(null);
    setLoading(true);
    fetch(`${API}/users?clubId=${clubId}`).then((r) => r.json()).then((response) => {
      setUsers(response.data || []);
      setLoading(false);
    });
  }, [clubId]);

  const toggleExpand = async (userId: string) => {
    if (expandedId === userId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }

    setExpandedId(userId);
    setDetailLoading(true);
    const response = await fetch(`${API}/features/player-detail/${userId}?clubId=${clubId}`).then((r) => r.json());
    setDetail(response.data);
    setDetailLoading(false);
  };

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== 'all' && user.role !== roleFilter) return false;
      if (activeFilter === 'active' && !user.is_active) return false;
      if (activeFilter === 'inactive' && user.is_active) return false;
      if (!term) return true;

      return (
        String(user.full_name ?? '').toLowerCase().includes(term) ||
        String(user.email ?? '').toLowerCase().includes(term)
      );
    });
  }, [users, search, roleFilter, activeFilter]);

  return (
    <div>
      <div className="page-header"><h1>Medlemmar</h1></div>
      {toast && <div className="toast">{toast}</div>}
      {users.filter(u => u.membership_status === 'pending').length > 0 && (
        <div style={{ marginBottom: 16, padding: '12px 18px', borderRadius: 10, background: '#fef3c7', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>&#9888;</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
            {users.filter(u => u.membership_status === 'pending').length} väntande medlemsansökningar kräver granskning
          </span>
        </div>
      )}

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card">
          <div className="label">Total</div>
          <div className="value" style={{ color: '#6366f1' }}>{users.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Top Padel</div>
          <div className="value" style={{ fontSize: 18, color: '#06b6d4' }}>{lbPadel[0]?.full_name || '-'}</div>
          <div className="sub">Elo: {lbPadel[0]?.elo || '-'}</div>
        </div>
        <div className="stat-card">
          <div className="label">Trainers</div>
          <div className="value" style={{ color: '#8b5cf6' }}>{users.filter((u) => u.role === 'trainer').length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <label style={lbl}>Club</label>
          <select value={clubId} onChange={(e) => setClubId(e.target.value)} style={inp}>
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 260 }}>
          <label style={lbl}>Search members</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email..." style={{ ...inp, minWidth: 260 }} />
        </div>
        <div>
          <label style={lbl}>Filter role</label>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)} style={inp}>
            <option value="all">All roles</option>
            <option value="player">Players</option>
            <option value="trainer">Trainers</option>
            <option value="admin">Admins</option>
            <option value="superadmin">Superadmins</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Status</label>
          <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as any)} style={inp}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <div style={{ alignSelf: 'center', fontSize: 12, color: 'var(--text-dim)' }}>{filteredUsers.length} members</div>
          <Link href="/groups" className="btn btn-outline" style={{ padding: '8px 12px', fontSize: 12 }}>Member Categories</Link>
          <Link href="/registration-forms" className="btn btn-outline" style={{ padding: '8px 12px', fontSize: 12 }}>Members Apply Form</Link>
        </div>
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th>Role</th>
                <th>Padel Elo</th>
                <th>Tennis Elo</th>
                <th>Matches</th>
                <th>Medlemskap</th>
                <th>Profile</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '18px 8px' }}>
                    No members match the current filters.
                  </td>
                </tr>
              ) : filteredUsers.map((user) => (
                <Fragment key={user.id}>
                  <tr onClick={() => toggleExpand(user.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 600, color: expandedId === user.id ? 'var(--accent)' : 'var(--text)' }}>
                      {expandedId === user.id ? '\u25BC' : '\u25B6'} {user.full_name}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{user.email}</td>
                    <td>
                      <span className={`badge ${user.role === 'trainer' ? 'badge-blue' : user.role === 'admin' || user.role === 'superadmin' ? 'badge-yellow' : 'badge-green'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td><span className="badge badge-blue">{user.elo_padel}</span></td>
                    <td><span className="badge badge-green">{user.elo_tennis}</span></td>
                    <td>{user.matches_played}</td>
                    <td>
                      {user.membership_status === 'pending' ? (
                        <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', animation: 'pulse-dot 2s infinite' }}>
                          VÄNTANDE
                        </span>
                      ) : user.membership_status === 'approved' ? (
                        <span style={{ padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd' }}>
                          Inväntar betalning
                        </span>
                      ) : user.membership_status === 'active' ? (
                        <span className="badge badge-green">{user.membership_type ?? 'Aktiv'}</span>
                      ) : user.membership_status === 'suspended' ? (
                        <span className="badge badge-red">Pausad</span>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/users/${user.id}`}
                        className="btn btn-outline"
                        style={{ padding: '4px 12px', fontSize: 11 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Stats &rarr;
                      </Link>
                    </td>
                  </tr>

                  {expandedId === user.id && (
                    <tr>
                      <td colSpan={8} style={{ padding: 0, background: 'var(--bg-body)' }}>
                        {detailLoading ? (
                          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading details...</div>
                        ) : detail ? (
                          <div style={{ padding: '16px 20px', animation: 'fadeUp 0.3s ease both' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                              <div>
                                <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                                  Member Categories ({detail.groups.length})
                                </h4>
                                {detail.groups.length === 0 ? (
                                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>No groups</span>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {detail.groups.map((group) => (
                                      <div key={group.id} style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12 }}>
                                        <span style={{ fontWeight: 600 }}>{group.name}</span>
                                        {group.parent_name && <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>({group.parent_name})</span>}
                                        <span className={`badge ${group.category === 'junior' ? 'badge-blue' : group.category === 'adult' ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: 9, marginLeft: 6, padding: '1px 6px' }}>
                                          {group.category}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div>
                                <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                                  Sessions Assigned ({detail.sessions.length})
                                </h4>
                                {detail.sessions.length === 0 ? (
                                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>No sessions</span>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {detail.sessions.slice(0, 5).map((session) => (
                                      <div key={session.id} style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12 }}>
                                        <span style={{ fontWeight: 600 }}>{session.title}</span>
                                        <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>
                                          {session.day_name} {String(session.start_hour).padStart(2, '0')}:00-{String(session.end_hour).padStart(2, '0')}:00 | {session.court_name} | <span style={{ color: '#4f46e5' }}>{session.trainer_name}</span>
                                          {session.applied_count > 0 && <span style={{ color: '#059669', marginLeft: 4 }}>{session.applied_count}x</span>}
                                        </div>
                                      </div>
                                    ))}
                                    {detail.sessions.length > 5 && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>+{detail.sessions.length - 5} more</span>}
                                  </div>
                                )}
                              </div>

                              <div>
                                <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                                  Member Data
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Name</span><span style={{ fontWeight: 600 }}>{detail.full_name}</span></div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Age</span><span style={{ fontWeight: 600 }}>{detail.age ?? '-'}</span></div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Email</span><span style={{ fontWeight: 600 }}>{detail.email}</span></div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Social number</span><span style={{ fontWeight: 600 }}>{detail.social_number ?? '-'}</span></div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Type of membership</span><span style={{ fontWeight: 600 }}>{detail.membership_type ?? '-'}</span></div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Sessions assigned</span><span style={{ fontWeight: 600 }}>{detail.sessions.length}</span></div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Bookings</span><span style={{ fontWeight: 600 }}>{detail.bookingCount}</span></div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Groups</span><span style={{ fontWeight: 600 }}>{detail.groups.length}</span></div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Forms</span><span style={{ fontWeight: 600 }}>{detail.submissions.length}</span></div>
                                </div>
                                {/* Form answers from membership application */}
                                {detail.memberships.some((m: any) => m.form_answers && Object.keys(m.form_answers).length > 0) && (
                                  <div style={{ marginTop: 10 }}>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Formulärsvar</div>
                                    {detail.memberships.filter((m: any) => m.form_answers && Object.keys(m.form_answers).length > 0).map((m: any, idx: number) => (
                                      <div key={idx} style={{ background: 'var(--bg-input)', borderRadius: 8, padding: '8px 12px', marginBottom: 4 }}>
                                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>{m.membership_type} — {m.club_name}</div>
                                        {Object.entries(m.form_answers as Record<string, unknown>).map(([key, val]) => (
                                          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>{key.replace(/_/g, ' ')}</span>
                                            <span style={{ fontWeight: 600 }}>{String(val)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Edit actions */}
                                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Actions</div>
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    <select
                                      defaultValue={users.find(u => u.id === expandedId)?.role ?? 'player'}
                                      onChange={e => updateUser(detail.id, { role: e.target.value })}
                                      disabled={editBusy}
                                      style={{ ...inp, minWidth: 100, padding: '4px 8px', fontSize: 11 }}
                                    >
                                      <option value="player">Player</option>
                                      <option value="trainer">Trainer</option>
                                      <option value="admin">Admin</option>
                                    </select>
                                    <button
                                      className="btn btn-outline"
                                      style={{ padding: '4px 10px', fontSize: 11 }}
                                      disabled={editBusy}
                                      onClick={() => {
                                        const name = prompt('Nytt namn:', detail.full_name);
                                        if (name) updateUser(detail.id, { fullName: name });
                                      }}
                                    >Byt namn</button>
                                    <button
                                      className="btn btn-outline"
                                      style={{ padding: '4px 10px', fontSize: 11 }}
                                      disabled={editBusy}
                                      onClick={() => {
                                        const phone = prompt('Nytt telefonnummer:', '');
                                        if (phone !== null) updateUser(detail.id, { phoneNumber: phone });
                                      }}
                                    >Byt telefon</button>
                                  </div>
                                </div>

                                {/* Memberships with actions */}
                                {detail.memberships.length > 0 && (
                                  <div style={{ marginTop: 10 }}>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                                      Memberships
                                    </div>
                                    {detail.memberships.map((membership: any) => (
                                      <div key={`${membership.club_id}-${membership.status}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', padding: '4px 0' }}>
                                        <span>{membership.club_name} - {membership.membership_type} ({membership.status})</span>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                          {membership.status === 'pending' && (
                                            <button onClick={() => updateMembership(membership.id, 'approved')} disabled={editBusy} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, border: '1px solid #a7f3d0', background: '#ecfdf5', color: '#059669', cursor: 'pointer', fontFamily: 'inherit' }}>Godkänn ansökan</button>
                                          )}
                                          {membership.status === 'approved' && (
                                            <>
                                              <span style={{ fontSize: 10, color: '#b45309', padding: '2px 6px', background: '#fef3c7', borderRadius: 4 }}>Väntar betalning</span>
                                              {membership.invoice_id && (
                                                <button onClick={async () => {
                                                  setEditBusy(true);
                                                  await fetch(`${API}/invoices/${membership.invoice_id}`, {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ status: 'paid', paidMethod: 'manual' }),
                                                  });
                                                  setEditBusy(false);
                                                  flash('Betalning registrerad — medlemskap aktiverat');
                                                  if (expandedId) {
                                                    const detailRes = await fetch(`${API}/features/player-detail/${expandedId}?clubId=${clubId}`).then(r => r.json());
                                                    setDetail(detailRes.data);
                                                  }
                                                }} disabled={editBusy} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, border: '1px solid #a7f3d0', background: '#ecfdf5', color: '#059669', cursor: 'pointer', fontFamily: 'inherit' }}>Markera betald</button>
                                              )}
                                            </>
                                          )}
                                          {membership.status === 'active' && (
                                            <button onClick={() => updateMembership(membership.id, 'suspended')} disabled={editBusy} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit' }}>Pausa</button>
                                          )}
                                          {membership.status === 'suspended' && (
                                            <button onClick={() => updateMembership(membership.id, 'active')} disabled={editBusy} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, border: '1px solid #a7f3d0', background: '#ecfdf5', color: '#059669', cursor: 'pointer', fontFamily: 'inherit' }}>Aktivera</button>
                                          )}
                                          <button onClick={() => removeMembership(membership.id)} disabled={editBusy} style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit' }}>Ta bort</button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Deactivate account */}
                                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                                  <button
                                    onClick={() => deactivateAccount(detail.id)}
                                    disabled={editBusy}
                                    style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit' }}
                                  >
                                    Deaktivera konto
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const lbl: CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: 5,
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
};

const inp: CSSProperties = {
  padding: '9px 12px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
  fontSize: 13,
  minWidth: 150,
  fontFamily: 'inherit',
};
