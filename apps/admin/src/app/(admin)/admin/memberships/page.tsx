'use client';
import { useEffect, useState } from 'react';
const API = '/api';

interface Membership { id: string; club_id: string; user_id: string; user_name: string; user_email: string | null; status: string; membership_type: string; applied_at: string; approved_at: string | null; notes: string | null; }
interface Club { id: string; name: string; }
interface MembershipType { id: string; name: string; description: string | null; price: number; currency: string; interval: string; }

const intervalLabels: Record<string, string> = { month: 'månad', quarter: 'kvartal', half_year: 'halvår', year: 'år', once: 'engångs' };

export default function AdminMembershipsPage() {
  const [clubs, setClubs] = useState<Club[]>([]); const [clubId, setClubId] = useState('');
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [types, setTypes] = useState<MembershipType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [showTypes, setShowTypes] = useState(false);
  const [newType, setNewType] = useState({ name: '', description: '', price: '', interval: 'month' });
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  useEffect(() => { fetch(`${API}/clubs`).then(r => r.json()).then(r => { setClubs(r.data ?? []); if (r.data?.length) setClubId(r.data[0].id); }); }, []);

  const loadTypes = () => {
    if (!clubId) return;
    fetch(`${API}/membership-types?clubId=${clubId}`).then(r => r.json()).then(r => setTypes(r.data ?? []));
  };

  const load = () => {
    if (!clubId) return;
    setLoading(true);
    const url = filter === 'all' ? `${API}/admin/memberships?clubId=${clubId}` : `${API}/admin/memberships?clubId=${clubId}&status=${filter}`;
    Promise.all([
      fetch(url).then(r => r.json()),
      fetch(`${API}/membership-types?clubId=${clubId}`).then(r => r.json()),
    ]).then(([membRes, typesRes]) => {
      setMemberships(membRes.data ?? []);
      setTypes(typesRes.data ?? []);
      setLoading(false);
    });
  };
  useEffect(load, [clubId, filter]);

  const createType = async () => {
    if (!newType.name.trim()) return;
    setBusy(true);
    const res = await fetch(`${API}/membership-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId, name: newType.name.trim(), description: newType.description || null, price: newType.price ? Number(newType.price) : 0, interval: newType.interval }),
    }).then(r => r.json());
    setBusy(false);
    if (!res.success) return flash(res.error ?? 'Kunde inte skapa');
    setNewType({ name: '', description: '', price: '', interval: 'month' });
    loadTypes();
    flash('Medlemskapstyp skapad');
  };

  const deleteType = async (id: string) => {
    setBusy(true);
    await fetch(`${API}/membership-types?id=${id}`, { method: 'DELETE' });
    setBusy(false);
    loadTypes();
    flash('Medlemskapstyp borttagen');
  };

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
        <button onClick={() => setShowTypes(!showTypes)} style={{ ...inp, cursor: 'pointer', background: showTypes ? '#eef2ff' : 'var(--bg-card)', color: showTypes ? '#4338ca' : 'inherit', fontWeight: 600, border: showTypes ? '1px solid #6366f1' : '1px solid var(--border)' }}>
          {showTypes ? 'Dölj typer' : 'Hantera medlemskapstyper'}
        </button>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>{memberships.length} medlemskap{pending.length > 0 && ` · ${pending.length} väntande`}</div>
      </div>

      {/* Membership types management */}
      {showTypes && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 0, marginBottom: 12 }}>Medlemskapstyper</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 90px 120px auto', gap: 8, alignItems: 'center', marginBottom: 14 }}>
            <input value={newType.name} onChange={e => setNewType(p => ({ ...p, name: e.target.value }))} placeholder="Namn (t.ex. Gold)" style={inp} />
            <input value={newType.description} onChange={e => setNewType(p => ({ ...p, description: e.target.value }))} placeholder="Beskrivning" style={inp} />
            <input value={newType.price} onChange={e => setNewType(p => ({ ...p, price: e.target.value }))} placeholder="Pris" type="number" min="0" style={inp} />
            <select value={newType.interval} onChange={e => setNewType(p => ({ ...p, interval: e.target.value }))} style={inp}>
              <option value="month">Per månad</option>
              <option value="quarter">Per kvartal</option>
              <option value="half_year">Per halvår</option>
              <option value="year">Per år</option>
              <option value="once">Engångs</option>
            </select>
            <button onClick={createType} disabled={busy || !newType.name.trim()} style={{ ...btnG, padding: '8px 16px', fontSize: 12 }}>Skapa</button>
          </div>

          {types.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>Inga medlemskapstyper skapade ännu för denna klubb.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {types.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</span>
                    {t.description && <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{t.description}</span>}
                    <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8 }}>
                      {t.price > 0 ? `${t.price} ${t.currency}` : 'Gratis'} / {intervalLabels[t.interval] ?? t.interval}
                    </span>
                  </div>
                  <button onClick={() => deleteType(t.id)} disabled={busy} style={{ ...btnR, padding: '3px 10px', fontSize: 10 }}>Ta bort</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
        {m.membership_type && m.membership_type !== 'standard' && <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 8, padding: '1px 8px', borderRadius: 6, background: '#eef2ff', color: '#4338ca' }}>{m.membership_type}</span>}
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
