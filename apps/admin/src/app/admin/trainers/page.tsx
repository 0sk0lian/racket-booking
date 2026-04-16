'use client';
import { useEffect, useState } from 'react';

const API = '/api';
const SPORTS = ['padel', 'tennis', 'squash', 'badminton'];

interface UserWithTrainer {
  id: string; email: string; full_name: string; phone_number: string | null;
  role: string; trainer_club_id: string | null; trainer_sport_types: string[];
  trainer_hourly_rate: number | null; trainer_monthly_salary: number | null;
  trainer_bio: string | null; trainer_certifications: string | null;
  weeklyHours: number; weeklySessions: number; upcomingBookedSessions: number;
  legacyTrainerId: string | null;
  elo_padel: number; elo_tennis: number; matches_played: number;
}
interface Club { id: string; name: string; }

export default function ManageTrainersPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState('');
  const [users, setUsers] = useState<UserWithTrainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState<'trainers' | 'all'>('trainers');

  // Edit modal
  const [edit, setEdit] = useState<UserWithTrainer | null>(null);
  const [eRole, setERole] = useState('player');
  const [eSports, setESports] = useState<string[]>([]);
  const [eRate, setERate] = useState('');
  const [eSalary, setESalary] = useState('');
  const [eBio, setEBio] = useState('');
  const [eCerts, setECerts] = useState('');
  const [eSaving, setESaving] = useState(false);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  useEffect(() => {
    fetch(`${API}/clubs`).then(r => r.json()).then(r => {
      setClubs(r.data || []);
      if (r.data?.length) setSelectedClub(r.data[0].id);
    });
  }, []);

  const reload = async () => {
    if (!selectedClub) return;
    setLoading(true);
    const r = await fetch(`${API}/admin/trainer-management?clubId=${selectedClub}`).then(r => r.json());
    setUsers(r.data || []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [selectedClub]);

  const trainers = users.filter(u => u.role === 'trainer');
  const nonTrainers = users.filter(u => u.role !== 'trainer');
  const displayUsers = tab === 'trainers' ? trainers : nonTrainers;

  const openEdit = (u: UserWithTrainer) => {
    setEdit(u); setERole(u.role); setESports(u.trainer_sport_types || []);
    setERate(String(u.trainer_hourly_rate || '')); setESalary(String(u.trainer_monthly_salary || ''));
    setEBio(u.trainer_bio || ''); setECerts(u.trainer_certifications || '');
  };

  const handleSave = async () => {
    if (!edit) return;
    setESaving(true);
    await fetch(`${API}/admin/trainer-management/${edit.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: eRole,
        trainerClubId: eRole === 'trainer' ? selectedClub : null,
        trainerSportTypes: eSports,
        trainerHourlyRate: eRate ? Number(eRate) : null,
        trainerMonthlySalary: eSalary ? Number(eSalary) : null,
        trainerBio: eBio || null,
        trainerCertifications: eCerts || null,
      }),
    });
    flash(eRole === 'trainer' ? `${edit.full_name} updated as trainer` : `${edit.full_name} role set to ${eRole}`);
    setEdit(null); setESaving(false);
    await reload();
  };

  const quickPromote = async (u: UserWithTrainer) => {
    await fetch(`${API}/admin/trainer-management/${u.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'trainer', trainerClubId: selectedClub, trainerSportTypes: ['padel'], trainerHourlyRate: 500 }),
    });
    flash(`${u.full_name} promoted to trainer`);
    await reload();
  };

  const toggleSport = (s: string) => setESports(eSports.includes(s) ? eSports.filter(x => x !== s) : [...eSports, s]);

  // Calculate total monthly cost
  const totalMonthlySalary = trainers.reduce((s, t) => s + (t.trainer_monthly_salary || 0), 0);
  const totalWeeklyHours = trainers.reduce((s, t) => s + t.weeklyHours, 0);

  return (
    <div>
      <div className="page-header">
        <h1>Manage Trainers</h1>
      </div>
      {toast && <div className="toast">{toast}</div>}

      {/* Club + tab */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-end' }}>
        <Fld label="Club">
          <select value={selectedClub} onChange={e => setSelectedClub(e.target.value)} style={inp}>
            {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Fld>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className={`btn ${tab === 'trainers' ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => setTab('trainers')}>
            Trainers ({trainers.length})
          </button>
          <button className={`btn ${tab === 'all' ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => setTab('all')}>
            All Users ({nonTrainers.length})
          </button>
        </div>
      </div>

      {/* Trainer stats */}
      {tab === 'trainers' && trainers.length > 0 && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
          <div className="stat-card"><div className="label">Active Trainers</div><div className="value" style={{ color: '#6366f1' }}>{trainers.length}</div></div>
          <div className="stat-card"><div className="label">Total Weekly Hours</div><div className="value" style={{ color: '#06b6d4' }}>{totalWeeklyHours}h</div><div className="sub">{trainers.reduce((s, t) => s + t.weeklySessions, 0)} sessions</div></div>
          <div className="stat-card"><div className="label">Monthly Salary Cost</div><div className="value" style={{ color: '#f59e0b' }}>{totalMonthlySalary.toLocaleString()}</div><div className="sub">SEK / month</div></div>
          <div className="stat-card"><div className="label">Upcoming Sessions</div><div className="value" style={{ color: '#10b981' }}>{trainers.reduce((s, t) => s + t.upcomingBookedSessions, 0)}</div><div className="sub">Booked trainings</div></div>
        </div>
      )}

      {loading ? <div className="loading">Loading...</div> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Role</th>
                {tab === 'trainers' && <><th>Sports</th><th>Hourly Rate</th><th>Monthly Salary</th><th>Weekly Hours</th><th>Sessions</th></>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayUsers.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'trainer' ? 'badge-blue' : u.role === 'admin' ? 'badge-yellow' : 'badge-green'}`}>
                      {u.role}
                    </span>
                  </td>
                  {tab === 'trainers' && <>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(u.trainer_sport_types || []).map(s => (
                          <span key={s} style={{ padding: '1px 8px', borderRadius: 10, fontSize: 11, background: 'var(--bg-body)', border: '1px solid var(--border)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{s}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{u.trainer_hourly_rate || '—'} <span style={{ fontWeight: 400, color: 'var(--text-dim)', fontSize: 12 }}>SEK/h</span></td>
                    <td style={{ fontWeight: 600 }}>{u.trainer_monthly_salary?.toLocaleString() || '—'} <span style={{ fontWeight: 400, color: 'var(--text-dim)', fontSize: 12 }}>SEK</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>{u.weeklyHours}h</span>
                        <div style={{ width: 60, height: 6, background: 'var(--bg-body)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(u.weeklyHours / 40 * 100, 100)}%`, background: 'linear-gradient(90deg, #6366f1, #06b6d4)', borderRadius: 3 }} />
                        </div>
                      </div>
                    </td>
                    <td>{u.weeklySessions} <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>weekly</span> / {u.upcomingBookedSessions} <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>booked</span></td>
                  </>}
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => openEdit(u)}>
                        {u.role === 'trainer' ? 'Edit' : 'Manage'}
                      </button>
                      {u.role !== 'trainer' && (
                        <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 11 }} onClick={() => quickPromote(u)}>
                          Make Trainer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Edit Modal ─── */}
      {edit && (
        <div style={overlay} onClick={() => setEdit(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{edit.full_name}</h2>
              <button onClick={() => setEdit(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </div>

            {/* User info */}
            <div style={{ background: 'var(--bg-body)', borderRadius: 10, padding: 14, marginBottom: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Info l="Email" v={edit.email} />
              <Info l="Phone" v={edit.phone_number || '—'} />
              <Info l="Matches Played" v={String(edit.matches_played)} />
            </div>

            {/* Role selector */}
            <Fld label="Role">
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {['player', 'trainer', 'admin'].map(r => (
                  <button key={r} onClick={() => setERole(r)} style={{
                    padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${eRole === r ? (r === 'trainer' ? '#6366f1' : r === 'admin' ? '#f59e0b' : '#10b981') : 'var(--border)'}`,
                    background: eRole === r ? (r === 'trainer' ? '#eef2ff' : r === 'admin' ? '#fef3c7' : '#ecfdf5') : 'var(--bg-body)',
                    color: eRole === r ? (r === 'trainer' ? '#4f46e5' : r === 'admin' ? '#b45309' : '#059669') : 'var(--text-muted)',
                    transition: 'all 0.15s', fontFamily: 'inherit', textTransform: 'capitalize',
                  }}>{r}</button>
                ))}
              </div>
            </Fld>

            {/* Trainer-specific fields */}
            {eRole === 'trainer' && (
              <div style={{ background: '#f8f9ff', border: '1px solid #e0e7ff', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Trainer Details</div>

                <Fld label="Sports">
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                    {SPORTS.map(s => {
                      const on = eSports.includes(s);
                      return <button key={s} onClick={() => toggleSport(s)} style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${on ? '#6366f1' : '#d1d5db'}`, background: on ? '#eef2ff' : '#fff',
                        color: on ? '#4f46e5' : '#6b7280', transition: 'all 0.15s', fontFamily: 'inherit', textTransform: 'capitalize',
                      }}>{s}{on && ' \u2713'}</button>;
                    })}
                  </div>
                </Fld>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <Fld label="Hourly Rate (SEK)">
                    <input type="number" min="0" value={eRate} onChange={e => setERate(e.target.value)} style={inp} placeholder="e.g. 600" />
                  </Fld>
                  <Fld label="Monthly Salary (SEK)">
                    <input type="number" min="0" value={eSalary} onChange={e => setESalary(e.target.value)} style={inp} placeholder="e.g. 28000" />
                  </Fld>
                </div>

                <Fld label="Bio">
                  <textarea value={eBio} onChange={e => setEBio(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' as const, fontFamily: 'inherit' }} placeholder="Short trainer bio..." />
                </Fld>

                <div style={{ marginTop: 14 }}>
                  <Fld label="Certifications">
                    <input value={eCerts} onChange={e => setECerts(e.target.value)} style={inp} placeholder="e.g. WPT Level 2, SvTF B-trainer" />
                  </Fld>
                </div>

                {/* Schedule summary */}
                {edit.role === 'trainer' && (
                  <div style={{ marginTop: 16, background: '#fff', borderRadius: 8, padding: 14, border: '1px solid #e0e7ff' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Current Schedule</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, fontSize: 13 }}>
                      <div><span style={{ color: 'var(--text-muted)' }}>Weekly hours:</span> <strong>{edit.weeklyHours}h</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Sessions/week:</span> <strong>{edit.weeklySessions}</strong></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Upcoming:</span> <strong>{edit.upcomingBookedSessions}</strong></div>
                    </div>
                    {edit.trainer_hourly_rate && edit.weeklyHours > 0 && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                        Est. weekly earnings: <strong style={{ color: 'var(--text)' }}>{(edit.trainer_hourly_rate * edit.weeklyHours).toLocaleString()} SEK</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={eSaving} style={{ flex: 1 }}>
                {eSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button className="btn btn-outline" onClick={() => setEdit(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={lbl}>{label}</label>{children}</div>; }
function Info({ l, v }: { l: string; v: string }) { return <div><div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase' as const, letterSpacing: '0.5px', fontWeight: 600, marginBottom: 2 }}>{l}</div><div style={{ fontSize: 14, fontWeight: 500 }}>{v}</div></div>; }

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.7px' };
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, transition: 'all 0.2s', width: '100%', fontFamily: 'inherit' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, animation: 'fadeIn 0.2s ease' };
const modal: React.CSSProperties = { background: 'var(--bg-card)', borderRadius: 18, padding: 32, width: 600, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '1px solid var(--border)', animation: 'fadeUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both' };
