'use client';
import { useEffect, useState } from 'react';
const API = '/api';

interface Club { id: string; name: string; }
interface MembershipType { id: string; name: string; description: string | null; price: number; currency: string; interval: string; }

const intervalLabels: Record<string, string> = { month: 'månad', quarter: 'kvartal', half_year: 'halvår', year: 'år', once: 'engångs' };

export default function AdminMembershipsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState('');
  const [types, setTypes] = useState<MembershipType[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [newType, setNewType] = useState({ name: '', description: '', price: '', interval: 'month' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ name: '', description: '', price: '', interval: '' });
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  useEffect(() => {
    fetch(`${API}/clubs`).then(r => r.json()).then(r => {
      setClubs(r.data ?? []);
      if (r.data?.length) setClubId(r.data[0].id);
    });
  }, []);

  const loadTypes = () => {
    if (!clubId) return;
    setLoading(true);
    fetch(`${API}/membership-types?clubId=${clubId}`).then(r => r.json()).then(r => {
      setTypes(r.data ?? []);
      setLoading(false);
    });
  };
  useEffect(loadTypes, [clubId]);

  const createType = async () => {
    if (!newType.name.trim()) return;
    setBusy(true);
    const res = await fetch(`${API}/membership-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clubId,
        name: newType.name.trim(),
        description: newType.description || null,
        price: newType.price ? Number(newType.price) : 0,
        interval: newType.interval,
      }),
    }).then(r => r.json());
    setBusy(false);
    if (!res.success) return flash(res.error ?? 'Kunde inte skapa');
    setNewType({ name: '', description: '', price: '', interval: 'month' });
    loadTypes();
    flash('Medlemskapstyp skapad');
  };

  const startEdit = (t: MembershipType) => {
    setEditingId(t.id);
    setEditValues({ name: t.name, description: t.description ?? '', price: String(t.price), interval: t.interval });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setBusy(true);
    const res = await fetch(`${API}/membership-types`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingId,
        name: editValues.name.trim(),
        description: editValues.description || null,
        price: editValues.price ? Number(editValues.price) : 0,
        interval: editValues.interval,
      }),
    }).then(r => r.json());
    setBusy(false);
    if (!res.success) return flash(res.error ?? 'Kunde inte uppdatera');
    setEditingId(null);
    loadTypes();
    flash('Uppdaterad');
  };

  const deleteType = async (id: string) => {
    setBusy(true);
    await fetch(`${API}/membership-types?id=${id}`, { method: 'DELETE' });
    setBusy(false);
    loadTypes();
    flash('Medlemskapstyp borttagen');
  };

  return (
    <div>
      <div className="page-header"><h1>Medlemskap</h1></div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: -8, marginBottom: 16 }}>
        Skapa och hantera medlemskapstyper som spelare kan välja när de ansöker om medlemskap.
      </p>
      {toast && <div className="toast">{toast}</div>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'flex-end' }}>
        <div>
          <label style={lbl}>Klubb</label>
          <select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>
            {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
          {types.length} typ{types.length !== 1 ? 'er' : ''}
        </div>
      </div>

      {/* Create new type */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0, marginBottom: 10 }}>Ny medlemskapstyp</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 90px 130px auto', gap: 8, alignItems: 'center' }}>
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
          <button onClick={createType} disabled={busy || !newType.name.trim()} className="btn btn-primary">Skapa</button>
        </div>
      </div>

      {/* Types list */}
      {loading ? <div className="loading">Laddar...</div> : types.length === 0 ? (
        <div className="empty-state">
          <h3>Inga medlemskapstyper</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Skapa din första typ ovan. Spelare ser dessa alternativ när de ansöker om medlemskap.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {types.map(t => (
            <div key={t.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
              {editingId === t.id ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 90px 130px auto auto', gap: 8, alignItems: 'center' }}>
                  <input value={editValues.name} onChange={e => setEditValues(p => ({ ...p, name: e.target.value }))} style={inp} />
                  <input value={editValues.description} onChange={e => setEditValues(p => ({ ...p, description: e.target.value }))} style={inp} />
                  <input value={editValues.price} onChange={e => setEditValues(p => ({ ...p, price: e.target.value }))} type="number" min="0" style={inp} />
                  <select value={editValues.interval} onChange={e => setEditValues(p => ({ ...p, interval: e.target.value }))} style={inp}>
                    <option value="month">Per månad</option>
                    <option value="quarter">Per kvartal</option>
                    <option value="half_year">Per halvår</option>
                    <option value="year">Per år</option>
                    <option value="once">Engångs</option>
                  </select>
                  <button onClick={saveEdit} disabled={busy} style={btnG}>Spara</button>
                  <button onClick={() => setEditingId(null)} style={btnO}>Avbryt</button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
                    {t.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t.description}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#6366f1' }}>
                        {t.price > 0 ? `${t.price} ${t.currency}` : 'Gratis'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                        {intervalLabels[t.interval] ?? t.interval}
                      </div>
                    </div>
                    <button onClick={() => startEdit(t)} style={btnO}>Redigera</button>
                    <button onClick={() => deleteType(t.id)} disabled={busy} style={btnR}>Ta bort</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 };
const inp: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', minWidth: 100 };
const btnG: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #a7f3d0', background: '#ecfdf5', color: '#059669', cursor: 'pointer', fontFamily: 'inherit' };
const btnR: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit' };
const btnO: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' };
