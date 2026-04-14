'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
const API = 'http://localhost:3001/api';
const CATS = [{ v: 'junior', l: 'Junior', c: '#06b6d4' }, { v: 'adult', l: 'Vuxen', c: '#10b981' }, { v: 'senior', l: 'Senior', c: '#f59e0b' }, { v: 'camp', l: 'Läger', c: '#ec4899' }, { v: 'competition', l: 'Tävling', c: '#ef4444' }];

export default function RegistrationFormsPage() {
  const [clubs, setClubs] = useState<any[]>([]); const [clubId, setClubId] = useState('');
  const [forms, setForms] = useState<any[]>([]); const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); const [toast, setToast] = useState('');
  const [filter, setFilter] = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [fTitle, setFTitle] = useState(''); const [fDesc, setFDesc] = useState('');
  const [fSport, setFSport] = useState('padel'); const [fCat, setFCat] = useState('adult');
  const [fSeason, setFSeason] = useState('Vår 2026'); const [fGroup, setFGroup] = useState('');
  const [fParentGroup, setFParentGroup] = useState('');
  const [fMax, setFMax] = useState('24'); const [saving, setSaving] = useState(false);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  useEffect(() => { fetch(`${API}/clubs`).then(r => r.json()).then(r => { setClubs(r.data || []); if (r.data?.length) setClubId(r.data[0].id); }); }, []);

  const reload = async () => {
    if (!clubId) return; setLoading(true);
    const [f, g] = await Promise.all([
      fetch(`${API}/registration-forms?clubId=${clubId}`).then(r => r.json()),
      fetch(`${API}/features/groups?clubId=${clubId}`).then(r => r.json()),
    ]);
    setForms(f.data || []); setGroups(g.data || []); setLoading(false);
  };
  useEffect(() => { reload(); }, [clubId]);

  const handleCreate = async () => {
    setSaving(true);
    const fields = fCat === 'junior'
      ? [{ key: 'age', label: 'Ålder', type: 'number', required: true }, { key: 'level', label: 'Spelnivå', type: 'select', options: ['Nybörjare', 'Medel', 'Avancerad'], required: true }, { key: 'parent_phone', label: 'Förälders telefon', type: 'text', required: true }, { key: 'notes', label: 'Övrigt', type: 'text', required: false }]
      : [{ key: 'level', label: 'Spelnivå', type: 'select', options: ['Nybörjare', 'Medel', 'Avancerad'], required: true }, { key: 'preferred_day', label: 'Önskad dag', type: 'text', required: false }, { key: 'previous_training', label: 'Har du tränat förut?', type: 'checkbox', required: false }, { key: 'notes', label: 'Övriga önskemål', type: 'text', required: false }];

    await fetch(`${API}/registration-forms`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId, title: fTitle, description: fDesc, sportType: fSport, category: fCat, season: fSeason, targetGroupId: fGroup || null, parentGroupId: fParentGroup || null, fields, maxSubmissions: Number(fMax) || null }),
    });
    flash('Formulär skapat'); setShowCreate(false); setFTitle(''); setFDesc('');
    setSaving(false); await reload();
  };

  const filtered = filter ? forms.filter(f => f.category === filter) : forms;
  const totalSubs = forms.reduce((s, f) => s + f.submission_count, 0);

  return (
    <div>
      <div className="page-header">
        <h1>Anmälningsformulär</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Avbryt' : '+ Nytt formulär'}
        </button>
      </div>
      {toast && <div className="toast">{toast}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
        <Fld label="Klubb"><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
        <Fld label="Filter">
          <div style={{ display: 'flex', gap: 4 }}>
            <button className={`btn ${!filter ? 'btn-primary' : 'btn-outline'}`} style={btnS} onClick={() => setFilter('')}>Alla</button>
            {CATS.map(c => <button key={c.v} className={`btn ${filter === c.v ? 'btn-primary' : 'btn-outline'}`} style={btnS} onClick={() => setFilter(c.v)}>{c.l}</button>)}
          </div>
        </Fld>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>{totalSubs} anmälningar totalt</div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="form-card" style={{ animation: 'fadeUp 0.3s ease both' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Nytt anmälningsformulär</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <Fld label="Titel"><input value={fTitle} onChange={e => setFTitle(e.target.value)} style={inp} placeholder="t.ex. Vuxentennis Vår 2026" /></Fld>
            <Fld label="Beskrivning"><input value={fDesc} onChange={e => setFDesc(e.target.value)} style={inp} placeholder="Info till medlemmar..." /></Fld>
            <Fld label="Sport"><select value={fSport} onChange={e => setFSport(e.target.value)} style={inp}><option value="padel">Padel</option><option value="tennis">Tennis</option><option value="squash">Squash</option></select></Fld>
            <Fld label="Kategori"><select value={fCat} onChange={e => setFCat(e.target.value)} style={inp}>{CATS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}</select></Fld>
            <Fld label="Termin"><input value={fSeason} onChange={e => setFSeason(e.target.value)} style={inp} /></Fld>
            <Fld label="Placera i befintlig grupp"><select value={fGroup} onChange={e => setFGroup(e.target.value)} style={inp}><option value="">Skapa ny grupp (från titel)</option>{groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Fld>
            <Fld label="Masterkategori (övergrupp)"><select value={fParentGroup} onChange={e => setFParentGroup(e.target.value)} style={inp}><option value="">Ingen</option>{groups.filter((g: any) => g.is_master_category).map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Fld>
            <Fld label="Max anmälningar"><input type="number" value={fMax} onChange={e => setFMax(e.target.value)} style={inp} /></Fld>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14 }}>En grupp med formulärets titel skapas automatiskt. Alla som anmäler sig placeras direkt i gruppen (och i masterkategorin om vald). Fält skapas baserat på kategori och kan redigeras efter.</p>
          <button className="btn btn-primary" onClick={handleCreate} disabled={saving || !fTitle}>{saving ? 'Skapar...' : 'Skapa formulär'}</button>
        </div>
      )}

      {loading ? <div className="loading">Loading...</div> : (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
          {filtered.map(f => {
            const catInfo = CATS.find(c => c.v === f.category);
            const pct = f.max_submissions ? Math.round((f.submission_count / f.max_submissions) * 100) : null;
            return (
              <Link key={f.id} href={`/registration-forms/${f.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-xs)', borderLeft: `4px solid ${catInfo?.c || '#6366f1'}` }}>
                  <div style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: `${catInfo?.c}15`, color: catInfo?.c, border: `1px solid ${catInfo?.c}30` }}>{catInfo?.l} &middot; {f.sport_type}</span>
                      <span className={`badge ${f.status === 'open' ? 'badge-green' : f.status === 'closed' ? 'badge-red' : 'badge-yellow'}`}>{f.status === 'open' ? 'Öppen' : f.status === 'closed' ? 'Stängd' : 'Utkast'}</span>
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{f.title}</h3>
                    {f.description && <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>{f.description}</p>}
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>{f.season} {f.target_group_name && <>&middot; Grupp: <strong>{f.target_group_name}</strong></>}</div>

                    {/* Progress */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>{f.submission_count}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>{f.max_submissions ? `/ ${f.max_submissions}` : ''} anmälningar</span>
                      {f.assigned_count > 0 && <span style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginLeft: 'auto' }}>{f.assigned_count} placerade</span>}
                    </div>
                    {pct !== null && (
                      <div style={{ height: 6, background: 'var(--bg-body)', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#10b981', borderRadius: 3, transition: 'width 0.5s' }} />
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.7px' }}>{label}</label>{children}</div>; }
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'inherit' };
const btnS: React.CSSProperties = { padding: '7px 12px', fontSize: 11 };
