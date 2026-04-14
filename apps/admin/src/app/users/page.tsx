'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
const API = 'http://localhost:3001/api';

interface PlayerDetail { id: string; full_name: string; email: string; groups: { id: string; name: string; category: string; parent_name: string | null }[]; sessions: { id: string; title: string; day_of_week: number; day_name: string; start_hour: number; end_hour: number; status: string; trainer_name: string; court_name: string; applied_count: number }[]; submissions: { form_title: string; submitted_at: string }[]; bookingCount: number; }

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [lbPadel, setLbPadel] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlayerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/users`).then(r => r.json()),
      fetch(`${API}/users/leaderboard?sport=padel`).then(r => r.json()),
    ]).then(([u, lb]) => { setUsers(u.data || []); setLbPadel(lb.data || []); setLoading(false); });
  }, []);

  const toggleExpand = async (userId: string) => {
    if (expandedId === userId) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(userId); setDetailLoading(true);
    const r = await fetch(`${API}/features/player-detail/${userId}`).then(r => r.json());
    setDetail(r.data); setDetailLoading(false);
  };

  return (
    <div>
      <div className="page-header"><h1>Spelare</h1></div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card"><div className="label">Totalt</div><div className="value" style={{ color: '#6366f1' }}>{users.length}</div></div>
        <div className="stat-card"><div className="label">Topp Padel</div><div className="value" style={{ fontSize: 18, color: '#06b6d4' }}>{lbPadel[0]?.full_name || '—'}</div><div className="sub">Elo: {lbPadel[0]?.elo || '—'}</div></div>
        <div className="stat-card"><div className="label">Tränare</div><div className="value" style={{ color: '#8b5cf6' }}>{users.filter(u => u.role === 'trainer').length}</div></div>
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Spelare</th><th>Email</th><th>Roll</th><th>Padel Elo</th><th>Tennis Elo</th><th>Matcher</th><th>Profil</th></tr></thead>
            <tbody>
              {users.map(u => (<>
                <tr key={u.id} onClick={() => toggleExpand(u.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600, color: expandedId === u.id ? 'var(--accent)' : 'var(--text)' }}>
                    {expandedId === u.id ? '\u25BC' : '\u25B6'} {u.full_name}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{u.email}</td>
                  <td><span className={`badge ${u.role === 'trainer' ? 'badge-blue' : u.role === 'admin' ? 'badge-yellow' : 'badge-green'}`}>{u.role}</span></td>
                  <td><span className="badge badge-blue">{u.elo_padel}</span></td>
                  <td><span className="badge badge-green">{u.elo_tennis}</span></td>
                  <td>{u.matches_played}</td>
                  <td><Link href={`/users/${u.id}`} className="btn btn-outline" style={{ padding: '4px 12px', fontSize: 11 }} onClick={e => e.stopPropagation()}>Stats &rarr;</Link></td>
                </tr>

                {/* Expanded detail row */}
                {expandedId === u.id && (
                  <tr key={`${u.id}-detail`}>
                    <td colSpan={7} style={{ padding: 0, background: 'var(--bg-body)' }}>
                      {detailLoading ? (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Laddar...</div>
                      ) : detail ? (
                        <div style={{ padding: '16px 20px', animation: 'fadeUp 0.3s ease both' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                            {/* Groups */}
                            <div>
                              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 8 }}>Grupper ({detail.groups.length})</h4>
                              {detail.groups.length === 0 ? <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Inga grupper</span> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {detail.groups.map(g => (
                                    <div key={g.id} style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12 }}>
                                      <span style={{ fontWeight: 600 }}>{g.name}</span>
                                      {g.parent_name && <span style={{ color: 'var(--text-dim)', marginLeft: 6 }}>({g.parent_name})</span>}
                                      <span className={`badge ${g.category === 'junior' ? 'badge-blue' : g.category === 'adult' ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: 9, marginLeft: 6, padding: '1px 6px' }}>{g.category}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Sessions */}
                            <div>
                              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 8 }}>Träningspass ({detail.sessions.length})</h4>
                              {detail.sessions.length === 0 ? <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Inga pass</span> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {detail.sessions.slice(0, 5).map(s => (
                                    <div key={s.id} style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12 }}>
                                      <span style={{ fontWeight: 600 }}>{s.title}</span>
                                      <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>
                                        {s.day_name} {String(s.start_hour).padStart(2, '0')}:00–{String(s.end_hour).padStart(2, '0')}:00 &middot; {s.court_name} &middot; <span style={{ color: '#4f46e5' }}>{s.trainer_name}</span>{s.applied_count > 0 && <span style={{ color: '#059669', marginLeft: 4 }}>{s.applied_count}×</span>}
                                        <span className={`badge ${s.status === 'synced' ? 'badge-green' : 'badge-yellow'}`} style={{ fontSize: 9, marginLeft: 6, padding: '1px 6px' }}>{s.status}</span>
                                      </div>
                                    </div>
                                  ))}
                                  {detail.sessions.length > 5 && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>+{detail.sessions.length - 5} till</span>}
                                </div>
                              )}
                            </div>

                            {/* Summary */}
                            <div>
                              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', marginBottom: 8 }}>Sammanfattning</h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Bokningar</span><span style={{ fontWeight: 600 }}>{detail.bookingCount}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Träningspass</span><span style={{ fontWeight: 600 }}>{detail.sessions.length}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Grupper</span><span style={{ fontWeight: 600 }}>{detail.groups.length}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Formulär</span><span style={{ fontWeight: 600 }}>{detail.submissions.length}</span></div>
                              </div>
                              {detail.submissions.length > 0 && (
                                <div style={{ marginTop: 10 }}>
                                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' as const }}>Anmälningar</span>
                                  {detail.submissions.map((s, i) => (
                                    <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.form_title}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )}
              </>))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
