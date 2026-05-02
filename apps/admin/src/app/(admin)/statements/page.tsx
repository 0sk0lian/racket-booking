'use client';
import { useEffect, useState } from 'react';
const API = '/api';

export default function StatementsPage() {
  const [clubs, setClubs] = useState<any[]>([]); const [clubId, setClubId] = useState('');
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(true);

  useEffect(() => { fetch(`${API}/clubs`).then(r => r.json()).then(r => { setClubs(r.data || []); if (r.data?.length) setClubId(r.data[0].id); }); }, []);
  useEffect(() => { if (!clubId) return; setLoading(true); fetch(`${API}/matchi/statements?clubId=${clubId}`).then(r => r.json()).then(r => { setData(r.data); setLoading(false); }); }, [clubId]);

  if (loading || !data) return <div className="loading">Laddar...</div>;
  const maxEarned = Math.max(...data.statements.map((s: any) => s.total_earned), 1);

  return (
    <div>
      <div className="page-header"><h1>Statements (Avstämning)</h1></div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <Fld label="Klubb"><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
      </div>

      {/* Explanation box */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: 16, marginBottom: 24, fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
        <strong>Statistik vs Statements:</strong> Statistikvyn visar intjänade intäkter (vad som skapats). Statements visar faktiska utbetalningar till ert bankkonto. Dessa siffror matchar sällan exakt — en bokning kan skapas i januari, spelas i februari och utbetalas i mars.
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        <div className="stat-card"><div className="label">Totalt Intjänat</div><div className="value" style={{ color: '#6366f1' }}>{data.summary.totalEarned.toLocaleString()}</div><div className="sub">SEK (alla perioder)</div></div>
        <div className="stat-card"><div className="label">Totalt Utbetalat</div><div className="value" style={{ color: '#10b981' }}>{data.summary.totalPaid.toLocaleString()}</div><div className="sub">SEK till bankkonto</div></div>
        <div className="stat-card"><div className="label">Väntar på utbetalning</div><div className="value" style={{ color: '#f59e0b' }}>{data.summary.pendingTotal.toLocaleString()}</div><div className="sub">SEK</div></div>
        <div className="stat-card"><div className="label">Perioder</div><div className="value" style={{ color: '#06b6d4' }}>{data.statements.length}</div></div>
      </div>

      {/* Chart: earned vs paid per period */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, marginBottom: 24, boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Intjänat vs Utbetalat per månad</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 180 }}>
          {data.statements.sort((a: any, b: any) => a.period.localeCompare(b.period)).map((s: any) => (
            <div key={s.period} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
                <div style={{ width: 22, height: `${(s.total_earned / maxEarned) * 150}px`, background: 'linear-gradient(180deg, #6366f1, #818cf8)', borderRadius: '4px 4px 0 0', minHeight: 4 }} title={`Intjänat: ${s.total_earned}`} />
                <div style={{ width: 22, height: `${(s.total_paid_out / maxEarned) * 150}px`, background: 'linear-gradient(180deg, #10b981, #34d399)', borderRadius: '4px 4px 0 0', minHeight: 4 }} title={`Utbetalat: ${s.total_paid_out}`} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{s.period.substring(5)}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#6366f1', borderRadius: 2, marginRight: 6 }} />Intjänat</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#10b981', borderRadius: 2, marginRight: 6 }} />Utbetalat</span>
        </div>
      </div>

      {/* Detailed table */}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Period</th><th>Intjänat</th><th>Utbetalat</th><th>Online</th><th>Klippkort</th><th>Sena avbokn.</th><th>Plattforms&shy;avgift</th><th>Diff</th></tr></thead>
          <tbody>
            {data.statements.sort((a: any, b: any) => b.period.localeCompare(a.period)).map((s: any) => {
              const diff = s.total_earned - s.total_paid_out;
              return (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700 }}>{s.period}</td>
                  <td style={{ fontWeight: 600 }}>{s.total_earned.toLocaleString()} SEK</td>
                  <td style={{ fontWeight: 600, color: '#059669' }}>{s.total_paid_out.toLocaleString()} SEK</td>
                  <td>{s.online_payments.toLocaleString()}</td>
                  <td>{s.clip_card_redemptions.toLocaleString()}</td>
                  <td>{s.late_cancellation_fees.toLocaleString()}</td>
                  <td style={{ color: 'var(--red)' }}>-{s.platform_fees.toLocaleString()}</td>
                  <td style={{ fontWeight: 600, color: diff > 0 ? '#f59e0b' : '#10b981' }}>{diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()} SEK</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.7px' }}>{label}</label>{children}</div>; }
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'inherit' };

