'use client';
import { useEffect, useState } from 'react';
const API = '/api';

export default function PriceCalendarPage() {
  const [clubs, setClubs] = useState<any[]>([]);
  const [clubId, setClubId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCourt, setSelectedCourt] = useState('');

  useEffect(() => { fetch(`${API}/clubs`).then(r => r.json()).then(r => { setClubs(r.data || []); if (r.data?.length) setClubId(r.data[0].id); }); }, []);
  useEffect(() => {
    if (!clubId) return; setLoading(true);
    fetch(`${API}/features/prices?clubId=${clubId}&date=${date}`).then(r => r.json()).then(r => { setData(r.data); setLoading(false); if (!selectedCourt && r.data?.days?.[0]?.courts?.length) setSelectedCourt(r.data.days[0].courts[0].courtId); });
  }, [clubId, date]);

  const priceColor = (price: number, min: number, max: number) => {
    if (max === min) return '#10b981';
    const pct = (price - min) / (max - min);
    if (pct < 0.33) return '#10b981';
    if (pct < 0.66) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div>
      <div className="page-header"><h1>Price Calendar</h1></div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Fld label="Club"><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
        <Fld label="Start Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} /></Fld>
        {data && <Fld label="Court"><select value={selectedCourt} onChange={e => setSelectedCourt(e.target.value)} style={inp}>{data.days[0]?.courts?.map((c: any) => <option key={c.courtId} value={c.courtId}>{c.courtName}</option>)}</select></Fld>}
        <div style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--text-muted)', alignItems: 'center', marginLeft: 'auto' }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#10b981' }} /> Billigast
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#f59e0b', marginLeft: 8 }} /> Medel
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#ef4444', marginLeft: 8 }} /> Peak
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#e2e8f0', marginLeft: 8 }} /> Bokad
        </div>
      </div>

      {loading ? <div className="loading">Laddar...</div> : data && (
        <div style={{ borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-card)', boxShadow: 'var(--shadow-sm)', overflow: 'auto' }}>
          <table style={{ fontSize: 12.5 }}>
            <thead><tr><th style={{ width: 70 }}>Tid</th>{data.days.map((d: any) => <th key={d.date} style={{ textAlign: 'center', minWidth: 100 }}>{d.dayName} {d.date.substring(5)}</th>)}</tr></thead>
            <tbody>
              {Array.from({ length: 15 }, (_, i) => i + 7).map(hour => (
                <tr key={hour}>
                  <td style={{ fontWeight: 600, color: 'var(--text-dim)' }}>{String(hour).padStart(2, '0')}:00</td>
                  {data.days.map((day: any) => {
                    const court = day.courts.find((c: any) => c.courtId === selectedCourt);
                    const slot = court?.hourPrices.find((h: any) => h.hour === hour);
                    if (!slot) return <td key={day.date} />;
                    return (
                      <td key={day.date} style={{ textAlign: 'center', padding: '8px 6px' }}>
                        {slot.booked ? (
                          <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 8, background: '#f1f5f9', color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>Bokad</span>
                        ) : (
                          <span style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 8, background: `${priceColor(slot.price, data.minPrice, data.maxPrice)}15`, color: priceColor(slot.price, data.minPrice, data.maxPrice), fontWeight: 700, fontSize: 13, border: `1px solid ${priceColor(slot.price, data.minPrice, data.maxPrice)}30`, cursor: 'pointer', transition: 'all 0.15s' }}>
                            {slot.price} kr
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.7px' }}>{label}</label>{children}</div>; }
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'inherit' };

