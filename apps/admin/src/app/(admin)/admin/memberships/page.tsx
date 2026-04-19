'use client';
import { useEffect, useState } from 'react';
const API = '/api';

interface Club { id: string; name: string; }
interface FormField { key: string; label: string; type: 'text' | 'number' | 'select' | 'checkbox' | 'date'; required: boolean; options?: string[]; }
interface MembershipType { id: string; name: string; description: string | null; price: number; currency: string; interval: string; form_fields: FormField[]; }

const intervalLabels: Record<string, string> = { month: 'månad', quarter: 'kvartal', half_year: 'halvår', year: 'år', once: 'engångs' };
const fieldTypeLabels: Record<string, string> = { text: 'Text', number: 'Nummer', select: 'Flerval', checkbox: 'Kryssruta', date: 'Datum' };

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
  const [editFields, setEditFields] = useState<FormField[]>([]);
  const [newField, setNewField] = useState<FormField>({ key: '', label: '', type: 'text', required: false });
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
        clubId, name: newType.name.trim(), description: newType.description || null,
        price: newType.price ? Number(newType.price) : 0, interval: newType.interval,
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
    setEditFields(t.form_fields ?? []);
    setNewField({ key: '', label: '', type: 'text', required: false });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    setBusy(true);
    const res = await fetch(`${API}/membership-types`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingId, name: editValues.name.trim(), description: editValues.description || null,
        price: editValues.price ? Number(editValues.price) : 0, interval: editValues.interval,
        formFields: editFields,
      }),
    }).then(r => r.json());
    setBusy(false);
    if (!res.success) return flash(res.error ?? 'Kunde inte uppdatera');
    setEditingId(null);
    loadTypes();
    flash('Uppdaterad');
  };

  const addField = () => {
    if (!newField.label.trim()) return;
    const key = newField.label.trim().toLowerCase().replace(/[^a-z0-9åäö]+/g, '_').replace(/^_|_$/g, '');
    setEditFields([...editFields, { ...newField, key, label: newField.label.trim() }]);
    setNewField({ key: '', label: '', type: 'text', required: false });
  };

  const removeField = (idx: number) => {
    setEditFields(editFields.filter((_, i) => i !== idx));
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
        Skapa medlemskapstyper och konfigurera ansökningsformuläret som spelare fyller i.
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {types.map(t => (
            <div key={t.id} style={{ background: 'var(--bg-card)', border: editingId === t.id ? '2px solid #6366f1' : '1px solid var(--border)', borderRadius: 12, padding: '16px 20px' }}>
              {editingId === t.id ? (
                <div>
                  {/* Edit type details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 90px 130px', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                    <input value={editValues.name} onChange={e => setEditValues(p => ({ ...p, name: e.target.value }))} style={inp} placeholder="Namn" />
                    <input value={editValues.description} onChange={e => setEditValues(p => ({ ...p, description: e.target.value }))} style={inp} placeholder="Beskrivning" />
                    <input value={editValues.price} onChange={e => setEditValues(p => ({ ...p, price: e.target.value }))} type="number" min="0" style={inp} placeholder="Pris" />
                    <select value={editValues.interval} onChange={e => setEditValues(p => ({ ...p, interval: e.target.value }))} style={inp}>
                      <option value="month">Per månad</option>
                      <option value="quarter">Per kvartal</option>
                      <option value="half_year">Per halvår</option>
                      <option value="year">Per år</option>
                      <option value="once">Engångs</option>
                    </select>
                  </div>

                  {/* Form fields editor */}
                  <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Formulärfält</div>

                    {editFields.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                        {editFields.map((f, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#fff', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{f.label}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-dim)', padding: '1px 8px', background: '#f1f5f9', borderRadius: 4 }}>{fieldTypeLabels[f.type]}</span>
                            {f.required && <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>Obligatorisk</span>}
                            {f.type === 'select' && f.options?.length ? <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>({f.options.join(', ')})</span> : null}
                            <button onClick={() => removeField(i)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>x</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px auto auto', gap: 8, alignItems: 'center' }}>
                      <input value={newField.label} onChange={e => setNewField(p => ({ ...p, label: e.target.value }))} placeholder="Fältnamn (t.ex. Telefon)" style={inp} />
                      <select value={newField.type} onChange={e => setNewField(p => ({ ...p, type: e.target.value as any }))} style={inp}>
                        <option value="text">Text</option>
                        <option value="number">Nummer</option>
                        <option value="select">Flerval</option>
                        <option value="checkbox">Kryssruta</option>
                        <option value="date">Datum</option>
                      </select>
                      <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <input type="checkbox" checked={newField.required} onChange={e => setNewField(p => ({ ...p, required: e.target.checked }))} />
                        Oblig.
                      </label>
                      <button onClick={addField} disabled={!newField.label.trim()} style={{ ...btnG, padding: '6px 12px' }}>Lägg till</button>
                    </div>

                    {newField.type === 'select' && (
                      <div style={{ marginTop: 6 }}>
                        <input
                          placeholder="Alternativ (kommaseparerade, t.ex. Nybörjare, Medel, Avancerad)"
                          style={{ ...inp, width: '100%' }}
                          onChange={e => setNewField(p => ({ ...p, options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={saveEdit} disabled={busy} style={btnG}>Spara</button>
                    <button onClick={() => setEditingId(null)} style={btnO}>Avbryt</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{t.name}</div>
                    {t.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{t.description}</div>}
                    {(t.form_fields?.length ?? 0) > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                        {t.form_fields.length} formulärfält: {t.form_fields.map(f => f.label).join(', ')}
                      </div>
                    )}
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
