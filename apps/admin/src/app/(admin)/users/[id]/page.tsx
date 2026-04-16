'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface PlayerStats {
  player: any;
  totalMatches: number; wins: number; losses: number; draws: number; winRate: number;
  sportStats: Record<string, { wins: number; losses: number; draws: number }>;
  eloHistory: { date: string; elo: number; sport: string }[];
  matchHistory: { id: string; date: string; sport: string; result: string; score: string; myScore: number; opponentScore: number; partner: string | null; opponents: string }[];
}

export default function PlayerProfilePage() {
  const { id } = useParams();
  const [data, setData] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:3001/api/stats/player/${id}`)
      .then(r => r.json())
      .then(res => { setData(res.data); setLoading(false); });
  }, [id]);

  if (loading) return <div className="loading">Loading player stats...</div>;
  if (!data) return <div className="empty-state">Player not found</div>;

  const { player, totalMatches, wins, losses, draws, winRate, sportStats, eloHistory, matchHistory } = data;

  // Build a simple SVG line chart for Elo progression
  const padelElo = eloHistory.filter(e => e.sport === 'padel');
  const tennisElo = eloHistory.filter(e => e.sport === 'tennis');

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/users" style={{ fontSize: 13, color: 'var(--text-dim)' }}>← Back to Players</Link>
          <h1 style={{ marginTop: 8 }}>{player.full_name}</h1>
          <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{player.email}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Total Matches</div>
          <div className="value">{totalMatches}</div>
        </div>
        <div className="stat-card">
          <div className="label">Win Rate</div>
          <div className="value" style={{ color: winRate >= 50 ? 'var(--green)' : 'var(--red)' }}>{winRate}%</div>
          <div className="sub">{wins}W / {losses}L / {draws}D</div>
        </div>
        <div className="stat-card">
          <div className="label">Padel Elo</div>
          <div className="value" style={{ color: 'var(--blue)' }}>{player.elo_padel}</div>
        </div>
        <div className="stat-card">
          <div className="label">Tennis Elo</div>
          <div className="value" style={{ color: 'var(--green)' }}>{player.elo_tennis}</div>
        </div>
      </div>

      {/* Win/Loss per Sport */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Performance by Sport</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Sport</th><th>W</th><th>L</th><th>D</th><th>Win %</th><th>Visual</th></tr></thead>
              <tbody>
                {Object.entries(sportStats).map(([sport, s]) => {
                  const total = s.wins + s.losses + s.draws;
                  const pct = total > 0 ? Math.round((s.wins / total) * 100) : 0;
                  return (
                    <tr key={sport}>
                      <td><span className={`badge ${sport === 'padel' ? 'badge-blue' : 'badge-green'}`}>{sport}</span></td>
                      <td style={{ color: 'var(--green)', fontWeight: 700 }}>{s.wins}</td>
                      <td style={{ color: 'var(--red)' }}>{s.losses}</td>
                      <td style={{ color: 'var(--yellow)' }}>{s.draws}</td>
                      <td style={{ fontWeight: 700 }}>{pct}%</td>
                      <td style={{ width: 120 }}>
                        <div style={{ height: 8, background: 'var(--bg-body)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 50 ? 'var(--green)' : 'var(--red)', borderRadius: 4, transition: 'width 0.8s ease' }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Elo Progression Chart */}
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Elo Progression</h2>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 22, boxShadow: 'var(--shadow-sm)' }}>
            {padelElo.length > 0 && <EloChart data={padelElo} label="Padel" color="#0ea5e9" />}
            {tennisElo.length > 0 && <EloChart data={tennisElo} label="Tennis" color="#10b981" />}
            {padelElo.length === 0 && tennisElo.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)' }}>No Elo data yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Match History */}
      <h2 style={{ fontSize: 18, marginBottom: 16 }}>Match History</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Sport</th><th>Result</th><th>Score</th><th>Partner</th><th>Opponents</th></tr></thead>
          <tbody>
            {matchHistory.map(m => (
              <tr key={m.id}>
                <td style={{ color: 'var(--text-muted)' }}>{new Date(m.date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })}</td>
                <td><span className={`badge ${m.sport === 'padel' ? 'badge-blue' : 'badge-green'}`}>{m.sport}</span></td>
                <td>
                  <span className={`badge ${m.result === 'win' ? 'badge-green' : m.result === 'loss' ? 'badge-red' : 'badge-yellow'}`}>
                    {m.result.toUpperCase()}
                  </span>
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>
                  <span style={{ color: m.result === 'win' ? 'var(--green)' : 'var(--text)' }}>{m.myScore}</span>
                  <span style={{ color: 'var(--text-dim)' }}> - </span>
                  <span style={{ color: m.result === 'loss' ? 'var(--red)' : 'var(--text)' }}>{m.opponentScore}</span>
                </td>
                <td>{m.partner || '—'}</td>
                <td>{m.opponents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EloChart({ data, label, color }: { data: { date: string; elo: number }[]; label: string; color: string }) {
  if (data.length < 2) return null;
  const elos = data.map(d => d.elo);
  const minElo = Math.min(...elos) - 20;
  const maxElo = Math.max(...elos) + 20;
  const range = maxElo - minElo || 1;
  const w = 360, h = 100, pad = 4;

  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((d.elo - minElo) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  const last = data[data.length - 1];
  const first = data[0];
  const diff = last.elo - first.elo;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color }}>{label}</span>
        <span style={{ fontSize: 13, color: diff >= 0 ? 'var(--green)' : 'var(--red)' }}>
          {diff >= 0 ? '+' : ''}{diff} pts
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 80 }}>
        <polyline fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
        {data.map((d, i) => {
          const x = pad + (i / (data.length - 1)) * (w - pad * 2);
          const y = h - pad - ((d.elo - minElo) / range) * (h - pad * 2);
          return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)' }}>
        <span>{first.date}</span>
        <span>{last.date}</span>
      </div>
    </div>
  );
}
