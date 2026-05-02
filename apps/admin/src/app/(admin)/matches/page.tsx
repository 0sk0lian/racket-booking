'use client';
import { useEffect, useState } from 'react';

interface Player { id: string; full_name: string; elo_padel: number; elo_tennis: number; }
interface Match {
  id: string; sport_type: string; team1_player_ids: string[]; team2_player_ids: string[];
  team1_score: number; team2_score: number; winner_team: number | null;
  played_at: string; elo_processed: boolean;
}

export default function MatchesPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');

  // Form state
  const [sport, setSport] = useState('padel');
  const [format, setFormat] = useState<'singles' | 'doubles'>('doubles');
  const [t1p1, setT1p1] = useState(''); const [t1p2, setT1p2] = useState('');
  const [t2p1, setT2p1] = useState(''); const [t2p2, setT2p2] = useState('');
  const [score1, setScore1] = useState(''); const [score2, setScore2] = useState('');

  const API = '/api';

  useEffect(() => {
    Promise.all([
      fetch(`${API}/users`).then(r => r.json()),
      fetch(`${API}/matches`).then(r => r.json()),
    ]).then(([u, m]) => {
      setPlayers(u.data || []);
      setMatches(m.data || []);
      setLoading(false);
    });
  }, []);

  const getName = (id: string) => players.find(p => p.id === id)?.full_name ?? '?';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const team1 = format === 'singles' ? [t1p1] : [t1p1, t1p2];
    const team2 = format === 'singles' ? [t2p1] : [t2p1, t2p2];

    // Quick login to get a token (use first player)
    const loginRes = await fetch(`${API}/users/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'anna@example.com', password: 'password123' }),
    }).then(r => r.json());

    const token = loginRes.data?.token;
    const res = await fetch(`${API}/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        sportType: sport, team1PlayerIds: team1, team2PlayerIds: team2,
        team1Score: Number(score1), team2Score: Number(score2),
      }),
    }).then(r => r.json());

    if (res.success) {
      setSuccess('Match registrerad! Elo-rating uppdaterad.');
      setShowForm(false);
      setScore1(''); setScore2('');
      // Refresh
      const m = await fetch(`${API}/matches`).then(r => r.json());
      setMatches(m.data || []);
      const u = await fetch(`${API}/users`).then(r => r.json());
      setPlayers(u.data || []);
      setTimeout(() => setSuccess(''), 4000);
    }
    setSubmitting(false);
  };

  const availablePlayers = (exclude: string[]) => players.filter(p => !exclude.includes(p.id) || exclude.length === 0);

  if (loading) return <div className="loading">Laddar matcher...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Matcher</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Avbryt' : '+ Registrera match'}
        </button>
      </div>

      {success && <div className="toast">{success}</div>}

      {showForm && (
        <div className="form-card">
          <h2 style={{ fontSize: 18, marginBottom: 20 }}>Registrera en match</h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Sport</label>
                <select value={sport} onChange={e => setSport(e.target.value)} style={inputStyle}>
                  <option value="padel">Padel</option>
                  <option value="tennis">Tennis</option>
                  <option value="squash">Squash</option>
                  <option value="badminton">Badminton</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Format</label>
                <select value={format} onChange={e => setFormat(e.target.value as any)} style={inputStyle}>
                  <option value="doubles">Dubbel (2 mot 2)</option>
                  <option value="singles">Singel (1 mot 1)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 20, marginBottom: 20 }}>
              {/* Team 1 */}
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', marginBottom: 12, letterSpacing: '1px' }}>LAG 1</div>
                <label style={labelStyle}>Spelare 1</label>
                <select value={t1p1} onChange={e => setT1p1(e.target.value)} style={inputStyle} required>
                  <option value="">Välj spelare...</option>
                  {availablePlayers([t1p2, t2p1, t2p2]).map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                {format === 'doubles' && <>
                  <label style={{ ...labelStyle, marginTop: 12 }}>Spelare 2</label>
                  <select value={t1p2} onChange={e => setT1p2(e.target.value)} style={inputStyle} required>
                    <option value="">Välj spelare...</option>
                    {availablePlayers([t1p1, t2p1, t2p2]).map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </>}
                <label style={{ ...labelStyle, marginTop: 12 }}>Poäng</label>
                <input type="number" min="0" max="99" value={score1} onChange={e => setScore1(e.target.value)} style={{ ...inputStyle, fontSize: 28, textAlign: 'center' as any, fontWeight: 700 }} placeholder="0" required />
              </div>

              {/* VS */}
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 24, fontWeight: 800, color: 'var(--text-dim)' }}>VS</div>

              {/* Team 2 */}
              <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 14, padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4f46e5', marginBottom: 12, letterSpacing: '1px' }}>LAG 2</div>
                <label style={labelStyle}>Spelare 1</label>
                <select value={t2p1} onChange={e => setT2p1(e.target.value)} style={inputStyle} required>
                  <option value="">Välj spelare...</option>
                  {availablePlayers([t1p1, t1p2, t2p2]).map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                {format === 'doubles' && <>
                  <label style={{ ...labelStyle, marginTop: 12 }}>Spelare 2</label>
                  <select value={t2p2} onChange={e => setT2p2(e.target.value)} style={inputStyle} required>
                    <option value="">Välj spelare...</option>
                    {availablePlayers([t1p1, t1p2, t2p1]).map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </>}
                <label style={{ ...labelStyle, marginTop: 12 }}>Poäng</label>
                <input type="number" min="0" max="99" value={score2} onChange={e => setScore2(e.target.value)} style={{ ...inputStyle, fontSize: 28, textAlign: 'center' as any, fontWeight: 700 }} placeholder="0" required />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%', justifyContent: 'center', padding: '12px 0', fontSize: 16 }}>
              {submitting ? 'Sparar...' : 'Registrera match och uppdatera Elo'}
            </button>
          </form>
        </div>
      )}

      {/* Match History Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Datum</th><th>Sport</th><th>Lag 1</th><th>Poäng</th><th>Lag 2</th><th>Resultat</th></tr>
          </thead>
          <tbody>
            {matches.map(m => {
              const t1Names = m.team1_player_ids.map(getName).join(' & ');
              const t2Names = m.team2_player_ids.map(getName).join(' & ');
              return (
                <tr key={m.id}>
                  <td style={{ color: 'var(--text-muted)' }}>{new Date(m.played_at).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}</td>
                  <td><span className={`badge ${m.sport_type === 'padel' ? 'badge-blue' : m.sport_type === 'tennis' ? 'badge-green' : 'badge-yellow'}`}>{m.sport_type}</span></td>
                  <td style={{ fontWeight: m.winner_team === 1 ? 700 : 400, color: m.winner_team === 1 ? 'var(--green)' : 'var(--text)' }}>{t1Names}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, textAlign: 'center' }}>
                    <span style={{ color: m.winner_team === 1 ? 'var(--green)' : 'var(--text)' }}>{m.team1_score}</span>
                    <span style={{ color: 'var(--text-dim)', margin: '0 6px' }}>-</span>
                    <span style={{ color: m.winner_team === 2 ? 'var(--green)' : 'var(--text)' }}>{m.team2_score}</span>
                  </td>
                  <td style={{ fontWeight: m.winner_team === 2 ? 700 : 400, color: m.winner_team === 2 ? 'var(--green)' : 'var(--text)' }}>{t2Names}</td>
                  <td>
                    {m.winner_team === null
                      ? <span className="badge badge-yellow">Oavgjort</span>
                      : <span className="badge badge-green">Lag {m.winner_team} vann</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' as any, letterSpacing: '0.7px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, transition: 'border-color 0.2s', outline: 'none' };

