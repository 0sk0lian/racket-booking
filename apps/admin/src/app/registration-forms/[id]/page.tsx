'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
const API = '/api';

interface FormField { key: string; label: string; type: 'text' | 'select' | 'number' | 'checkbox'; options?: string[]; required: boolean; }

export default function FormDetailPage() {
  const { id } = useParams();
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [groups, setGroups] = useState<any[]>([]);
  const [tab, setTab] = useState<'submissions' | 'settings' | 'fields'>('submissions');

  // Settings edit state
  const [eTitle, setETitle] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [eStatus, setEStatus] = useState('open');
  const [eMax, setEMax] = useState('');
  const [eGroup, setEGroup] = useState('');
  const [eSport, setESport] = useState('padel');
  const [eCat, setECat] = useState('adult');
  const [eSeason, setESeason] = useState('');
  const [saving, setSaving] = useState(false);

  // Fields edit state
  const [fields, setFields] = useState<FormField[]>([]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  const reload = async () => {
    setLoading(true);
    const [r, g] = await Promise.all([
      fetch(`${API}/registration-forms/${id}`).then(r => r.json()),
      fetch(`${API}/features/groups`).then(r => r.json()),
    ]);
    setForm(r.data);
    setGroups(g.data || []);
    // Populate edit state
    if (r.data) {
      setETitle(r.data.title); setEDesc(r.data.description || '');
      setEStatus(r.data.status); setEMax(String(r.data.max_submissions || ''));
      setEGroup(r.data.target_group_id || ''); setESport(r.data.sport_type);
      setECat(r.data.category); setESeason(r.data.season || '');
      setFields(r.data.fields ? r.data.fields.map((f: any) => ({ ...f })) : []);
    }
    setLoading(false);
  };
  useEffect(() => { reload(); }, [id]);

  // Save settings
  const saveSettings = async () => {
    setSaving(true);
    await fetch(`${API}/registration-forms/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: eTitle, description: eDesc || null, status: eStatus, maxSubmissions: Number(eMax) || null, targetGroupId: eGroup || null, sportType: eSport, category: eCat, season: eSeason }),
    });
    flash('Inställningar sparade'); setSaving(false); await reload();
  };

  // Save fields
  const saveFields = async () => {
    setSaving(true);
    await fetch(`${API}/registration-forms/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    flash('Fält sparade'); setSaving(false); await reload();
  };

  // Field editor helpers
  const addField = () => {
    const key = `field_${Date.now()}`;
    setFields([...fields, { key, label: '', type: 'text', required: false }]);
  };
  const removeField = (idx: number) => setFields(fields.filter((_, i) => i !== idx));
  const updateField = (idx: number, patch: Partial<FormField>) => {
    const updated = [...fields];
    updated[idx] = { ...updated[idx], ...patch };
    setFields(updated);
  };
  const moveField = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= fields.length) return;
    const updated = [...fields];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    setFields(updated);
  };

  // Assign helpers
  const assignAll = async () => {
    const r = await fetch(`${API}/registration-forms/${id}/assign-all`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).then(r => r.json());
    if (r.success) flash(`${r.data.assigned} spelare placerade i ${r.data.group_name}`);
    else flash('Fel: ' + r.error);
    await reload();
  };
  const assignOne = async (submissionId: string) => {
    const r = await fetch(`${API}/registration-forms/${id}/assign-one`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submissionId }) }).then(r => r.json());
    if (r.success) flash(`${r.data.user_name} placerad i ${r.data.group_name}`);
    await reload();
  };

  if (loading || !form) return <div className="loading">Loading...</div>;

  const subs = form.submissions || [];
  const unassigned = subs.filter((s: any) => !s.assigned_to_group);
  let filtered = subs;
  if (search) filtered = filtered.filter((s: any) => s.user_name?.toLowerCase().includes(search.toLowerCase()) || s.user_email?.toLowerCase().includes(search.toLowerCase()));
  if (filterLevel) filtered = filtered.filter((s: any) => s.answers?.level === filterLevel);
  const levels = [...new Set(subs.map((s: any) => s.answers?.level).filter(Boolean))] as string[];

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/registration-forms" style={{ fontSize: 13, color: 'var(--text-dim)' }}>&larr; Alla formulär</Link>
          <h1 style={{ marginTop: 8 }}>{form.title}</h1>
          {form.description && <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>{form.description}</p>}
        </div>
        {form.target_group_name && unassigned.length > 0 && tab === 'submissions' && (
          <button className="btn btn-primary" onClick={assignAll} style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)', boxShadow: '0 2px 12px rgba(16,185,129,0.3)' }}>
            Placera alla ({unassigned.length}) i {form.target_group_name}
          </button>
        )}
      </div>
      {toast && <div className="toast">{toast}</div>}

      {/* Stats */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 20 }}>
        <div className="stat-card"><div className="label">Anmälningar</div><div className="value" style={{ color: '#6366f1' }}>{form.submission_count}</div>{form.max_submissions && <div className="sub">av max {form.max_submissions}</div>}</div>
        <div className="stat-card"><div className="label">Placerade</div><div className="value" style={{ color: '#10b981' }}>{form.assigned_count}</div></div>
        <div className="stat-card"><div className="label">Ej placerade</div><div className="value" style={{ color: '#f59e0b' }}>{unassigned.length}</div></div>
        <div className="stat-card"><div className="label">Målgrupp</div><div className="value" style={{ fontSize: 16, color: '#06b6d4' }}>{form.target_group_name || '—'}</div></div>
        <div className="stat-card"><div className="label">Status</div><div className="value" style={{ fontSize: 16 }}><span className={`badge ${form.status === 'open' ? 'badge-green' : 'badge-red'}`}>{form.status === 'open' ? 'Öppen' : 'Stängd'}</span></div></div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['submissions', 'fields', 'settings'] as const).map(t => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '8px 18px', fontSize: 13 }} onClick={() => setTab(t)}>
            {t === 'submissions' ? `Anmälningar (${subs.length})` : t === 'fields' ? `Fält (${fields.length})` : 'Inställningar'}
          </button>
        ))}
      </div>

      {/* ─── Tab: Submissions ─── */}
      {tab === 'submissions' && (<>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'flex-end' }}>
          <Fld label="Sök spelare"><input value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, maxWidth: 300 }} placeholder="Namn eller email..." /></Fld>
          {levels.length > 0 && (
            <Fld label="Filtrera nivå">
              <div style={{ display: 'flex', gap: 4 }}>
                <button className={`btn ${!filterLevel ? 'btn-primary' : 'btn-outline'}`} style={btnS} onClick={() => setFilterLevel('')}>Alla</button>
                {levels.map(l => <button key={l} className={`btn ${filterLevel === l ? 'btn-primary' : 'btn-outline'}`} style={btnS} onClick={() => setFilterLevel(l)}>{l}</button>)}
              </div>
            </Fld>
          )}
          <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>Visar {filtered.length} av {subs.length}</div>
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr><th>Spelare</th><th>Email</th>{form.fields?.map((f: any) => <th key={f.key}>{f.label}</th>)}<th>Anmäld</th><th>Status</th><th>Åtgärd</th></tr></thead>
            <tbody>
              {filtered.map((s: any) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.user_name}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{s.user_email}</td>
                  {form.fields?.map((f: any) => (
                    <td key={f.key} style={{ fontSize: 13 }}>
                      {f.type === 'checkbox' ? (s.answers?.[f.key] ? <span style={{ color: '#10b981', fontWeight: 600 }}>Ja</span> : <span style={{ color: 'var(--text-dim)' }}>Nej</span>) : (s.answers?.[f.key] ?? <span style={{ color: 'var(--text-dim)' }}>—</span>)}
                    </td>
                  ))}
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(s.submitted_at).toLocaleDateString('sv-SE')}</td>
                  <td><span className={`badge ${s.assigned_to_group ? 'badge-green' : 'badge-yellow'}`}>{s.assigned_to_group ? 'Placerad' : 'Väntar'}</span></td>
                  <td>{!s.assigned_to_group && form.target_group_id && <button className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => assignOne(s.id)}>Placera</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}

      {/* ─── Tab: Fields Editor ─── */}
      {tab === 'fields' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={saveFields} disabled={saving}>{saving ? 'Sparar...' : 'Spara fält'}</button>
            <button className="btn btn-outline" onClick={addField}>+ Lägg till fält</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fields.map((f, idx) => (
              <div key={f.key} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: '32px 1fr 120px 120px 80px auto', gap: 12, alignItems: 'center', boxShadow: 'var(--shadow-xs)' }}>
                {/* Reorder */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button onClick={() => moveField(idx, -1)} disabled={idx === 0} style={arrowBtn}>&uarr;</button>
                  <button onClick={() => moveField(idx, 1)} disabled={idx === fields.length - 1} style={arrowBtn}>&darr;</button>
                </div>

                {/* Label */}
                <div>
                  <label style={miniLbl}>Etikett</label>
                  <input value={f.label} onChange={e => updateField(idx, { label: e.target.value })} style={inp} placeholder="t.ex. Spelnivå" />
                </div>

                {/* Type */}
                <div>
                  <label style={miniLbl}>Typ</label>
                  <select value={f.type} onChange={e => updateField(idx, { type: e.target.value as any })} style={inp}>
                    <option value="text">Text</option>
                    <option value="number">Nummer</option>
                    <option value="select">Flerval</option>
                    <option value="checkbox">Kryssruta</option>
                  </select>
                </div>

                {/* Required */}
                <div>
                  <label style={miniLbl}>Obligatorisk</label>
                  <button onClick={() => updateField(idx, { required: !f.required })} style={{ ...inp, cursor: 'pointer', textAlign: 'center' as const, fontWeight: 600, color: f.required ? '#059669' : 'var(--text-dim)', background: f.required ? '#ecfdf5' : 'var(--bg-input)', borderColor: f.required ? '#a7f3d0' : 'var(--border)' }}>
                    {f.required ? 'Ja' : 'Nej'}
                  </button>
                </div>

                {/* Options (for select type) */}
                <div>
                  {f.type === 'select' && (
                    <>
                      <label style={miniLbl}>Alternativ</label>
                      <input value={(f.options || []).join(', ')} onChange={e => updateField(idx, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} style={inp} placeholder="A, B, C" />
                    </>
                  )}
                </div>

                {/* Delete */}
                <button onClick={() => removeField(idx)} style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', alignSelf: 'flex-end' }}>Ta bort</button>
              </div>
            ))}
          </div>

          {fields.length === 0 && (
            <div className="empty-state" style={{ padding: 40 }}>
              <p style={{ color: 'var(--text-dim)' }}>Inga fält ännu. Klicka "+ Lägg till fält" för att börja.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab: Settings ─── */}
      {tab === 'settings' && (
        <div style={{ maxWidth: 600 }}>
          <div className="form-card">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <Fld label="Titel"><input value={eTitle} onChange={e => setETitle(e.target.value)} style={inp} /></Fld>
              <Fld label="Status">
                <select value={eStatus} onChange={e => setEStatus(e.target.value)} style={inp}>
                  <option value="open">Öppen</option>
                  <option value="closed">Stängd</option>
                  <option value="draft">Utkast</option>
                </select>
              </Fld>
              <div style={{ gridColumn: '1 / -1' }}>
                <Fld label="Beskrivning"><textarea value={eDesc} onChange={e => setEDesc(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' as const, fontFamily: 'inherit' }} /></Fld>
              </div>
              <Fld label="Sport">
                <select value={eSport} onChange={e => setESport(e.target.value)} style={inp}>
                  <option value="padel">Padel</option><option value="tennis">Tennis</option><option value="squash">Squash</option><option value="badminton">Badminton</option>
                </select>
              </Fld>
              <Fld label="Kategori">
                <select value={eCat} onChange={e => setECat(e.target.value)} style={inp}>
                  <option value="adult">Vuxen</option><option value="junior">Junior</option><option value="senior">Senior</option><option value="camp">Läger</option><option value="competition">Tävling</option>
                </select>
              </Fld>
              <Fld label="Termin"><input value={eSeason} onChange={e => setESeason(e.target.value)} style={inp} placeholder="t.ex. Vår 2026" /></Fld>
              <Fld label="Max anmälningar"><input type="number" value={eMax} onChange={e => setEMax(e.target.value)} style={inp} /></Fld>
              <div style={{ gridColumn: '1 / -1' }}>
                <Fld label="Placera anmälda i grupp">
                  <select value={eGroup} onChange={e => setEGroup(e.target.value)} style={inp}>
                    <option value="">Ingen automatisk grupp</option>
                    {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name} ({g.category})</option>)}
                  </select>
                </Fld>
              </div>
            </div>
            <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>{saving ? 'Sparar...' : 'Spara inställningar'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.7px' }}>{label}</label>{children}</div>; }
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'inherit' };
const btnS: React.CSSProperties = { padding: '7px 12px', fontSize: 11 };
const miniLbl: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: '0.5px' };
const arrowBtn: React.CSSProperties = { width: 24, height: 20, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg-body)', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' };
