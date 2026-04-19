'use client';
import { useEffect, useState } from 'react';
const API = '/api';

interface Membership { id: string; club_id: string; user_id: string; user_name: string; user_email: string | null; status: string; membership_type: string; applied_at: string; approved_at: string | null; notes: string | null; }
interface Club { id: string; name: string; }

export default function AdminMembershipsPage() {
  const [clubs, setClubs] = useState<Club[]>([]); const [clubId, setClubId] = useState('');
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  useEffect(() => { fetch(`${API}/clubs`).then(r => r.json()).then(r => { setClubs(r.data ?? []); if (r.data?.length) setClubId(r.data[0].id); }); }, []);

  const load = () => {
    if (!clubId) return;
    setLoading(true);
    const url = filter === 'all' ? `${API}/admin/memberships?clubId=${clubId}` : `${API}/admin/memberships?clubId=${clubId}&status=${filter}`;
    fetch(url).then(r => r.json()).then(r => { setMemberships(r.data ?? []); setLoading(false); });
  };
  useEffect(load, [clubId, filter]);

  const update = async (id: string, status: string) => {
    await fetch(`${API}/admin/memberships`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    flash(`Medlemskap ${status === 'active' ? 'godkänt' : status === 'suspended' ? 'pausat' : 'uppdaterat'}`);
    load();
  };

  const pending = memberships.filter(m => m.status === 'pending');
  const active = memberships.filter(m => m.status === 'active');
  const other = memberships.filter(m => m.status !== 'pending' && m.status !== 'active');

  const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
    pending: { bg: '#fef3c7', color: '#b45309' },
    active: { bg: '#ecfdf5', color: '#059669' },
    suspended: { bg: '#fef2f2', color: '#dc2626' },
    cancelled: { bg: '#f1f5f9', color: '#64748b' },
  };

  return (
    <div>
      <div className="page-header"><h1>Medlemshantering</h1></div>
      {toast && <div className="toast">{toast}</div>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
        <div><label style={lbl}>Klubb</label><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label style={lbl}>Filter</label><select value={filter} onChange={e => setFilter(e.target.value)} style={inp}><option value="all">Alla</option><option value="pending">Väntande</option><option value="active">Aktiva</option><option value="suspended">Pausade</option></select></div>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>{memberships.length} medlemskap{pending.length > 0 && ` · ${pending.length} väntande`}</div>
      </div>

      {loading ? <div className="loading">Laddar...</div> : memberships.length === 0 ? (
        <div className="empty-state"><p style={{ fontSize: 42, marginBottom: 8 }}>🏢</p><h3>Inga medlemskap</h3></div>
      ) : (<>
        {pending.length > 0 && (<>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#b45309' }}>Väntande ({pending.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {pending.map(m => (
              <MemberRow key={m.id} m={m} colors={STATUS_COLORS} onApprove={() => update(m.id, 'active')} onReject={() => update(m.id, 'cancelled')} />
            ))}
          </div>
        </>)}
        {active.length > 0 && (<>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Aktiva ({active.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {active.map(m => (
              <MemberRow key={m.id} m={m} colors={STATUS_COLORS} onSuspend={() => update(m.id, 'suspended')} />
            ))}
          </div>
        </>)}
        {other.length > 0 && (<>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: 'var(--text-dim)' }}>Övriga ({other.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {other.map(m => <MemberRow key={m.id} m={m} colors={STATUS_COLORS} onReactivate={() => update(m.id, 'active')} />)}
          </div>
        </>)}
      </>)}
    </div>
  );
}

function MemberRow({ m, colors, onApprove, onReject, onSuspend, onReactivate }: { m: any; colors: any; onApprove?: () => void; onReject?: () => void; onSuspend?: () => void; onReactivate?: () => void }) {
  const s = colors[m.status] ?? colors.pending;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
      <div>
        <span style={{ fontSize: 14, fontWeight: 600 }}>{m.user_name}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{m.user_email}</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>{new Date(m.applied_at).toLocaleDateString('sv-SE')}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: s.bg, color: s.color, textTransform: 'capitalize' }}>{m.status}</span>
        {onApprove && <button onClick={onApprove} style={btnG}>Godkänn</button>}
        {onReject && <button onClick={onReject} style={btnR}>Avvisa</button>}
        {onSuspend && <button onClick={onSuspend} style={btnR}>Pausa</button>}
        {onReactivate && <button onClick={onReactivate} style={btnG}>Återaktivera</button>}
      </div>
    </div>
  );
}
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 };
const inp: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', minWidth: 140 };
const btnG: React.CSSProperties = { padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid #a7f3d0', background: '#ecfdf5', color: '#059669', cursor: 'pointer', fontFamily: 'inherit' };
const btnR: React.CSSProperties = { padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit' };
