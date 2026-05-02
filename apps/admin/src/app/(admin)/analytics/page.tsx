'use client';
import { useEffect, useState } from 'react';

interface Overview {
  totalMatches: number; totalBookings: number; totalPlayers: number; totalCourts: number;
  sportBreakdown: Record<string, number>;
  weeksData: { week: string; matches: number; bookings: number }[];
  closeMatches: number; decisiveMatches: number;
}

interface Player { id: string; full_name: string; elo_padel: number; elo_tennis: number; matches_played: number; }

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/dashboard').then(r => r.json()).then(r => ({ data: { totalMatches: 0, totalBookings: r.data?.today_bookings ?? 0, totalPlayers: r.data?.active_members ?? 0, totalCourts: 0, sportBreakdown: { padel: 0, tennis: 0 }, weeksData: [], closeMatches: 0, decisiveMatches: 0 } })),
      fetch('/api/users').then(r => r.json()),
    ]).then(([o, p]) => {
      setOverview(o.data);
      setPlayers(p.data || []);
      setLoading(false);
    });
  }, []);

  if (loading || !overview) return <div className="loading">Laddar analys...</div>;

  const sportEntries = Object.entries(overview.sportBreakdown);
  const totalSportMatches = sportEntries.reduce((s, [, v]) => s + v, 0);
  const sportColors: Record<string, string> = { padel: '#38bdf8', tennis: '#4ade80', squash: '#fbbf24', badminton: '#f87171' };

  // Sorted players for Elo bar charts
  const padelRank = [...players].filter(p => p.matches_played > 0).sort((a, b) => b.elo_padel - a.elo_padel).slice(0, 8);
  const tennisRank = [...players].filter(p => p.matches_played > 0).sort((a, b) => b.elo_tennis - a.elo_tennis).slice(0, 8);

  const maxPadelElo = padelRank[0]?.elo_padel || 1500;
  const maxTennisElo = tennisRank[0]?.elo_tennis || 1500;

  return (
    <div>
      <div className="page-header"><h1>Analys</h1></div>

      {/* KPI Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Spelade matcher</div>
          <div className="value">{overview.totalMatches}</div>
        </div>
        <div className="stat-card">
          <div className="label">Aktiva spelare</div>
          <div className="value">{overview.totalPlayers}</div>
        </div>
        <div className="stat-card">
          <div className="label">Jämna matcher (1 poängs skillnad)</div>
          <div className="value" style={{ color: 'var(--yellow)' }}>{overview.closeMatches}</div>
          <div className="sub">{totalSportMatches > 0 ? Math.round((overview.closeMatches / totalSportMatches) * 100) : 0}% av alla matcher</div>
        </div>
        <div className="stat-card">
          <div className="label">Klara segrar (4+ poäng)</div>
          <div className="value" style={{ color: 'var(--green)' }}>{overview.decisiveMatches}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 32 }}>
        {/* Activity Over Time — Bar Chart */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Veckoaktivitet</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 180 }}>
            {overview.weeksData.map((w, i) => {
              const maxVal = Math.max(...overview.weeksData.map(d => d.matches + d.bookings), 1);
              const matchH = (w.matches / maxVal) * 150;
              const bookH = (w.bookings / maxVal) * 150;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                    <div style={{ width: 32, height: matchH, background: 'linear-gradient(180deg, #818cf8, #6366f1)', borderRadius: '6px 6px 0 0', minHeight: w.matches ? 4 : 0, transition: 'height 0.6s ease' }} title={`${w.matches} matcher`} />
                    <div style={{ width: 32, height: bookH, background: 'linear-gradient(180deg, #38bdf8, #0ea5e9)', borderRadius: '0 0 6px 6px', minHeight: w.bookings ? 4 : 0, transition: 'height 0.6s ease' }} title={`${w.bookings} bokningar`} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{w.week}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#818cf8', borderRadius: 2, marginRight: 6 }} />Matcher</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#38bdf8', borderRadius: 2, marginRight: 6 }} />Bokningar</span>
          </div>
        </div>

        {/* Sport Breakdown — Donut */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Fördelning per sport</h3>
          <DonutChart data={sportEntries} total={totalSportMatches} colors={sportColors} />
          <div style={{ marginTop: 16 }}>
            {sportEntries.map(([sport, count]) => (
              <div key={sport} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: sportColors[sport] || '#888' }} />
                  <span style={{ fontSize: 14, textTransform: 'capitalize' }}>{sport}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{count} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>({totalSportMatches > 0 ? Math.round((count / totalSportMatches) * 100) : 0}%)</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Elo Rankings — Horizontal Bar Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Padel Elo-ranking</h3>
          {padelRank.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ width: 20, fontSize: 14, fontWeight: 700, color: i < 3 ? 'var(--yellow)' : 'var(--text-dim)' }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{p.full_name}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8' }}>{p.elo_padel}</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-body)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(p.elo_padel / maxPadelElo) * 100}%`, background: 'linear-gradient(90deg, #6366f1, #0ea5e9)', borderRadius: 4, transition: 'width 0.8s ease' }} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Tennis Elo-ranking</h3>
          {tennisRank.map((p, i) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ width: 20, fontSize: 14, fontWeight: 700, color: i < 3 ? 'var(--yellow)' : 'var(--text-dim)' }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{p.full_name}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#4ade80' }}>{p.elo_tennis}</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-body)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(p.elo_tennis / maxTennisElo) * 100}%`, background: 'linear-gradient(90deg, #059669, #34d399)', borderRadius: 4, transition: 'width 0.8s ease' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DonutChart({ data, total, colors }: { data: [string, number][]; total: number; colors: Record<string, string> }) {
  const size = 140, stroke = 20, radius = (size - stroke) / 2, circ = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map(([sport, count]) => {
          const pct = total > 0 ? count / total : 0;
          const dashLen = pct * circ;
          const dashOff = -offset;
          offset += dashLen;
          return (
            <circle key={sport} cx={size / 2} cy={size / 2} r={radius}
              fill="none" stroke={colors[sport] || '#888'} strokeWidth={stroke}
              strokeDasharray={`${dashLen} ${circ - dashLen}`} strokeDashoffset={dashOff}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          );
        })}
        <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fill="var(--text)" fontSize="24" fontWeight="700">{total}</text>
      </svg>
    </div>
  );
}
