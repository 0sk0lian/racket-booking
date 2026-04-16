'use client';
import { useEffect, useState } from 'react';
const API = '/api';
const CATS = [{ v: 'junior', l: 'Junior', c: '#06b6d4' }, { v: 'adult', l: 'Vuxen', c: '#10b981' }, { v: 'senior', l: 'Senior', c: '#f59e0b' }, { v: 'camp', l: 'Läger', c: '#ec4899' }, { v: 'competition', l: 'Tävling', c: '#ef4444' }, { v: 'other', l: 'Övrigt', c: '#64748b' }];

export default function GroupsPage() {
  const [clubs, setClubs] = useState<any[]>([]); const [clubId, setClubId] = useState('');
  const [groups, setGroups] = useState<any[]>([]); const [users, setUsers] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); const [toast, setToast] = useState('');
  const [filter, setFilter] = useState('');

  // Modal
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editId, setEditId] = useState('');
  const [fName, setFName] = useState(''); const [fCat, setFCat] = useState('junior');
  const [fSport, setFSport] = useState('padel'); const [fParent, setFParent] = useState('');
  const [fPlayers, setFPlayers] = useState<string[]>([]); const [fTrainers, setFTrainers] = useState<string[]>([]);
  const [fMax, setFMax] = useState('12'); const [fNotes, setFNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };
  useEffect(() => {
    Promise.all([fetch(`${API}/clubs`).then(r => r.json()), fetch(`${API}/users`).then(r => r.json())])
      .then(([c, u]) => { setClubs(c.data || []); setUsers(u.data || []); if (c.data?.length) setClubId(c.data[0].id); });
  }, []);

  const reload = async () => { if (!clubId) return; setLoading(true); const [g, t] = await Promise.all([fetch(`${API}/features/groups?clubId=${clubId}`).then(r => r.json()), fetch(`${API}/admin/trainers?clubId=${clubId}`).then(r => r.json())]); setGroups(g.data || []); setTrainers(t.data || []); setLoading(false); };
  useEffect(() => { reload(); }, [clubId]);

  const openCreate = (parentId?: string) => { setModal('create'); setEditId(''); setFName(''); setFCat('junior'); setFSport('padel'); setFParent(parentId || ''); setFPlayers([]); setFTrainers([]); setFMax('12'); setFNotes(''); };
  const openEdit = (g: any) => { setModal('edit'); setEditId(g.id); setFName(g.name); setFCat(g.category); setFSport(g.sport_type); setFParent(g.parent_group_id || ''); setFPlayers(g.player_ids); setFTrainers(g.trainer_ids); setFMax(String(g.max_size || '')); setFNotes(g.notes || ''); };

  const handleSave = async () => {
    setSaving(true);
    const body: any = { clubId, name: fName, category: fCat, sportType: fSport, playerIds: fPlayers, trainerIds: fTrainers, maxSize: Number(fMax) || null, notes: fNotes, parentGroupId: fParent || null };
    const url = modal === 'edit' ? `${API}/features/groups/${editId}` : `${API}/features/groups`;
    await fetch(url, { method: modal === 'edit' ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    flash(modal === 'edit' ? 'Grupp uppdaterad' : 'Grupp skapad'); setModal(null); setSaving(false); await reload();
  };
  const handleDelete = async () => { if (!confirm('Ta bort gruppen?')) return; await fetch(`${API}/features/groups/${editId}`, { method: 'DELETE' }); flash('Grupp borttagen'); setModal(null); await reload(); };
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter(x => x !== id) : [...list, id]);

  // Separate master categories from child groups
  const masterCategories = groups.filter(g => g.is_master_category && !g.parent_group_id);
  const childGroups = groups.filter(g => g.parent_group_id);
  const ungrouped = groups.filter(g => !g.is_master_category && !g.parent_group_id);
  const filtered = filter ? [...masterCategories, ...childGroups, ...ungrouped].filter(g => g.category === filter) : null;

  return (
    <div>
      <div className="page-header"><h1>Grupper</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => openCreate()}>+ Ny Kategori</button>
          <button className="btn btn-primary" onClick={() => openCreate()}>+ Ny Grupp</button>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'flex-end' }}>
        <Fld label="Klubb"><select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>{clubs.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Fld>
        <Fld label="Filter">
          <div style={{ display: 'flex', gap: 4 }}>
            <button className={`btn ${!filter ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '7px 12px', fontSize: 11 }} onClick={() => setFilter('')}>Alla</button>
            {CATS.map(cat => <button key={cat.v} className={`btn ${filter === cat.v ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '7px 12px', fontSize: 11 }} onClick={() => setFilter(cat.v)}>{cat.l}</button>)}
          </div>
        </Fld>
      </div>

      {loading ? <div className="loading">Loading...</div> : filter ? (
        /* Flat filtered view */
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {filtered!.map(g => <GroupCard key={g.id} g={g} onEdit={() => openEdit(g)} />)}
        </div>
      ) : (
        /* Hierarchical view */
        <div>
          {masterCategories.map(master => {
            const catInfo = CATS.find(c => c.v === master.category);
            const children = childGroups.filter(g => g.parent_group_id === master.id);
            return (
              <div key={master.id} style={{ marginBottom: 28 }}>
                {/* Master category header */}
                <div onClick={() => openEdit(master)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', background: `${catInfo?.c}08`, border: `1px solid ${catInfo?.c}25`, borderRadius: 14, cursor: 'pointer', marginBottom: 12, transition: 'all 0.2s' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: `${catInfo?.c}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: catInfo?.c }}>{master.name.charAt(0)}</div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{master.name}</h3>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {children.length} grupper &middot; {master.total_members} medlemmar totalt &middot;
                      <span style={{ padding: '1px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: `${catInfo?.c}15`, color: catInfo?.c, marginLeft: 4 }}>{catInfo?.l}</span>
                    </div>
                  </div>
                  <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 11 }} onClick={e => { e.stopPropagation(); openCreate(master.id); }}>+ Grupp i kategori</button>
                </div>

                {/* Child groups */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, paddingLeft: 20 }}>
                  {children.map(g => <GroupCard key={g.id} g={g} onEdit={() => openEdit(g)} />)}
                  {children.length === 0 && <div style={{ padding: 20, color: 'var(--text-dim)', fontSize: 13 }}>Inga grupper i denna kategori ännu</div>}
                </div>
              </div>
            );
          })}

          {/* Ungrouped */}
          {ungrouped.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>Utan kategori</h3>
              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {ungrouped.map(g => <GroupCard key={g.id} g={g} onEdit={() => openEdit(g)} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Create/Edit Modal ─── */}
      {modal && (
        <div style={ov} onClick={() => setModal(null)}><div style={md} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><h2 style={{ fontSize: 18, fontWeight: 700 }}>{modal === 'edit' ? 'Redigera grupp' : 'Ny grupp'}</h2><button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <Fld label="Namn"><input value={fName} onChange={e => setFName(e.target.value)} style={inp} /></Fld>
            <Fld label="Sport"><select value={fSport} onChange={e => setFSport(e.target.value)} style={inp}><option value="padel">Padel</option><option value="tennis">Tennis</option><option value="squash">Squash</option></select></Fld>
            <Fld label="Kategori"><select value={fCat} onChange={e => setFCat(e.target.value)} style={inp}>{CATS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}</select></Fld>
            <Fld label="Tillhör masterkategori">
              <select value={fParent} onChange={e => setFParent(e.target.value)} style={inp}>
                <option value="">Ingen (fristående)</option>
                {masterCategories.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Fld>
            <Fld label="Max storlek"><input type="number" value={fMax} onChange={e => setFMax(e.target.value)} style={inp} /></Fld>
            <Fld label="Anteckningar"><input value={fNotes} onChange={e => setFNotes(e.target.value)} style={inp} /></Fld>
          </div>
          <Fld label="Tränare"><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>{trainers.map((t: any) => { const on = fTrainers.includes(t.id); return <button key={t.id} type="button" onClick={() => toggle(fTrainers, setFTrainers, t.id)} style={{ ...chip, borderColor: on ? '#6366f1' : 'var(--border)', background: on ? '#eef2ff' : 'var(--bg-body)', color: on ? '#4f46e5' : 'var(--text-muted)' }}>{t.full_name}{on && ' \u2713'}</button>; })}</div></Fld>
          <Fld label="Spelare"><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>{users.filter((u: any) => u.role !== 'trainer').map((u: any) => { const on = fPlayers.includes(u.id); return <button key={u.id} type="button" onClick={() => toggle(fPlayers, setFPlayers, u.id)} style={{ ...chip, borderColor: on ? '#10b981' : 'var(--border)', background: on ? '#ecfdf5' : 'var(--bg-body)', color: on ? '#059669' : 'var(--text-muted)' }}>{u.full_name}{on && ' \u2713'}</button>; })}</div></Fld>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 1 }}>{saving ? 'Sparar...' : modal === 'edit' ? 'Spara' : 'Skapa grupp'}</button>
            <button className="btn btn-outline" onClick={() => setModal(null)}>Avbryt</button>
            {modal === 'edit' && <button onClick={handleDelete} style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red-border)', borderRadius: 10, padding: '10px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>Ta bort</button>}
          </div>
        </div></div>
      )}
    </div>
  );
}

function GroupCard({ g, onEdit }: { g: any; onEdit: () => void }) {
  const catInfo = CATS.find(c => c.v === g.category);
  return (
    <div onClick={onEdit} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-xs)', borderLeft: `4px solid ${catInfo?.c || '#6366f1'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700 }}>{g.name}</h3>
        <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: `${catInfo?.c}15`, color: catInfo?.c, border: `1px solid ${catInfo?.c}30` }}>{catInfo?.l}</span>
      </div>
      {g.parent_group_name && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>I: {g.parent_group_name}</div>}
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 8 }}>
        {g.sport_type} &middot; {g.player_ids.length}{g.max_size ? `/${g.max_size}` : ''} spelare
      </div>
      {g.trainers?.length > 0 && <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>Tränare: {g.trainers.map((t: any) => t.full_name).join(', ')}</div>}
      {g.players?.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>{g.players.slice(0, 5).map((p: any) => <span key={p.id} style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, background: 'var(--bg-body)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>{p.full_name.split(' ')[0]}</span>)}{g.players.length > 5 && <span style={{ fontSize: 10, color: 'var(--text-dim)', alignSelf: 'center' }}>+{g.players.length - 5}</span>}</div>}
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) { return <div><label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '0.7px' }}>{label}</label>{children}</div>; }
const inp: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, width: '100%', fontFamily: 'inherit' };
const chip: React.CSSProperties = { padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.15s', fontFamily: 'inherit' };
const ov: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 };
const md: React.CSSProperties = { background: 'var(--bg-card)', borderRadius: 18, padding: 32, width: 600, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '1px solid var(--border)', animation: 'fadeUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both' };
