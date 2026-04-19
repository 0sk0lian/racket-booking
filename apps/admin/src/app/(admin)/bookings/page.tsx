'use client';
/**
 * Bokningar — admin booking list with filters, status/type pills, and CSV export.
 */
import { useEffect, useState } from 'react';

const API = '/api';

interface Booking {
  id: string; startHour: number; endHour: number; status: string; bookingType: string;
  bookerName: string; totalPrice: number; accessPin: string; trainerName: string | null;
  courtName: string; notes: string | null;
}
interface CourtSchedule { courtId: string; courtName: string; sportType: string; bookings: Booking[]; }
interface Club { id: string; name: string; }

export default function BookingsPage() {
  const [clubs, setClubs] = useState<Club[]>([]); const [clubId, setClubId] = useState('');
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    fetch(`${API}/clubs`).then(r => r.json()).then(r => { setClubs(r.data ?? []); if (r.data?.length) setClubId(r.data[0].id); });
  }, []);

  useEffect(() => {
    if (!clubId) return;
    setLoading(true);
    fetch(`${API}/admin/schedule?clubId=${clubId}&date=${date}`).then(r => r.json()).then(r => {
      const all: Booking[] = [];
      (r.data?.courts ?? []).forEach((c: CourtSchedule) => {
        c.bookings.forEach(b => all.push({ ...b, courtName: c.courtName }));
      });
      all.sort((a, b) => a.startHour - b.startHour);
      setAllBookings(all);
      setLoading(false);
    });
  }, [clubId, date]);

  const filtered = allBookings.filter(b => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (typeFilter !== 'all' && b.bookingType !== typeFilter) return false;
    return true;
  });

  const totalRev = filtered.filter(b => b.status === 'confirmed').reduce((s, b) => s + (b.totalPrice ?? 0), 0);

  const exportCSV = () => {
    const rows = ['Tid,Bana,Spelare,Typ,Status,Pris,PIN'];
    filtered.forEach(b => rows.push(`${String(b.startHour).padStart(2,'0')}:00-${String(b.endHour).padStart(2,'0')}:00,"${b.courtName}","${b.bookerName}",${b.bookingType},${b.status},${b.totalPrice},${b.accessPin ?? ''}`));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bokningar-${date}.csv`; a.click();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Bokningar</h1>
        <button className="btn btn-outline" onClick={exportCSV}>Exportera CSV</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Fld label="Klubb"><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
        <Fld label="Datum"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} /></Fld>
        <Fld label="Status"><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={inp}><option value="all">Alla</option><option value="confirmed">Bekräftade</option><option value="pending">Väntande</option><option value="cancelled">Avbokade</option></select></Fld>
        <Fld label="Typ"><select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={inp}><option value="all">Alla</option><option value="regular">Bokning</option><option value="training">Träning</option><option value="contract">Kontrakt</option><option value="event">Event</option></select></Fld>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>{filtered.length} bokningar · {totalRev.toFixed(0)} SEK</div>
      </div>

      {loading ? <div className="loading">Laddar...</div> : filtered.length === 0 ? (
        <div className="empty-state"><p style={{ fontSize: 42, marginBottom: 8 }}>📅</p><h3>Inga bokningar denna dag</h3></div>
      ) : (
        <div className="table-wrap">
          <table><thead><tr><th>Tid</th><th>Bana</th><th>Spelare</th><th>Typ</th><th>Status</th><th>Pris</th><th>PIN</th></tr></thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id}>
                  <td style={{ fontSize: 13, fontWeight: 500 }}>{String(b.startHour).padStart(2,'0')}:00–{String(b.endHour).padStart(2,'0')}:00</td>
                  <td style={{ fontWeight: 600 }}>{b.courtName}</td>
                  <td>{b.bookerName}{b.trainerName && <span style={{ color: 'var(--text-dim)', fontSize: 11, marginLeft: 4 }}>({b.trainerName})</span>}</td>
                  <td><Pill type={b.bookingType} /></td>
                  <td><StatusPill status={b.status} /></td>
                  <td style={{ fontWeight: 600 }}>{b.totalPrice?.toFixed(0)} <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>SEK</span></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-dim)' }}>{b.accessPin ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Pill({ type }: { type: string }) {
  const c: Record<string, { bg: string; color: string }> = { regular: { bg: '#ecfdf5', color: '#059669' }, training: { bg: '#eef2ff', color: '#4f46e5' }, contract: { bg: '#fef3c7', color: '#b45309' }, event: { bg: '#fce7f3', color: '#be185d' } };
  const s = c[type] ?? c.regular;
  return <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, textTransform: 'capitalize' }}>{type}</span>;
}
function StatusPill({ status }: { status: string }) {
  const c: Record<string, { bg: string; color: string }> = { confirmed: { bg: '#ecfdf5', color: '#059669' }, pending: { bg: '#fef3c7', color: '#b45309' }, cancelled: { bg: '#fef2f2', color: '#dc2626' } };
  const s = c[status] ?? c.pending;
  return <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, textTransform: 'capitalize' }}>{status}</span>;
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</label>{children}</div>;
}
const inp: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', minWidth: 140 };
