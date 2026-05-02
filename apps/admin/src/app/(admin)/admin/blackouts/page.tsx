'use client';
/**
 * Blackouts — first-class closures (holidays, maintenance, tournaments) that
 * the recurrence engine always skips when generating bookings.
 *
 * Backed by /api/blackouts CRUD. Paired with the ApplyPreviewModal which shows
 * per-date blackout skips during Apply-to-Period.
 */
import { useEffect, useState, CSSProperties } from 'react';

const API = '/api';

interface Club { id: string; name: string; }
interface Court { id: string; name: string; sport_type: string; }
interface Blackout {
  id: string;
  club_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  court_ids: string[];
  court_names: string[];
  created_at: string;
}

export default function BlackoutsPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState('');
  const [courts, setCourts] = useState<Court[]>([]);
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  // Form
  const [showForm, setShowForm] = useState(false);
  const [fStart, setFStart] = useState('');
  const [fEnd, setFEnd] = useState('');
  const [fReason, setFReason] = useState('');
  const [fCourts, setFCourts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/clubs`).then(r => r.json()).then(r => {
      setClubs(r.data ?? []);
      if (r.data?.length) setClubId(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!clubId) return;
    Promise.all([
      fetch(`${API}/courts?clubId=${clubId}`).then(r => r.json()),
      fetch(`${API}/blackouts?clubId=${clubId}`).then(r => r.json()),
    ]).then(([c, b]) => {
      setCourts(c.data ?? []);
      setBlackouts(b.data ?? []);
      setLoading(false);
    });
  }, [clubId]);

  const reload = async () => {
    if (!clubId) return;
    const r = await fetch(`${API}/blackouts?clubId=${clubId}`).then(r => r.json());
    setBlackouts(r.data ?? []);
  };

  const toggleCourt = (id: string) =>
    setFCourts(fCourts.includes(id) ? fCourts.filter(x => x !== id) : [...fCourts, id]);

  const openForm = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    setFStart(`${yyyy}-${mm}-${dd}T00:00`);
    setFEnd(`${yyyy}-${mm}-${dd}T23:59`);
    setFReason('');
    setFCourts([]);
    setShowForm(true);
  };

  const save = async () => {
    if (!fStart || !fEnd) { flash('Start- och sluttid krävs'); return; }
    setSaving(true);
    const r = await fetch(`${API}/blackouts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clubId,
        startsAt: new Date(fStart).toISOString(),
        endsAt: new Date(fEnd).toISOString(),
        reason: fReason || null,
        courtIds: fCourts,
      }),
    }).then(r => r.json());
    setSaving(false);
    if (r.success) {
      flash('Stängning skapad');
      setShowForm(false);
      await reload();
    } else {
      flash(`Fel: ${r.error}`);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Ta bort den här stängningen?')) return;
    await fetch(`${API}/blackouts/${id}`, { method: 'DELETE' });
    flash('Stängning borttagen');
    await reload();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Stängningar</h1>
        <button className="btn btn-primary" onClick={openForm}>+ Ny stängning</button>
      </div>
      {toast && <div className="toast">{toast}</div>}

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18, maxWidth: 680 }}>
        Stängningar är perioder när banor är stängda, till exempel helgdagar, turneringar eller
        underhåll. Schemaläggningen hoppar automatiskt över dem när återkommande bokningar läggs ut,
        och de syns som egna rader i förhandsvisningen för periodtillämpning.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        <Field label="Klubb">
          <select value={clubId} onChange={e => setClubId(e.target.value)} style={inp}>
            {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', alignSelf: 'flex-end' }}>
          {blackouts.length} stängning{blackouts.length === 1 ? '' : 'ar'}
        </div>
      </div>

      {loading ? <div className="loading">Laddar…</div> : blackouts.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: 42, marginBottom: 10 }}>🚧</p>
          <h3>Inga stängningar</h3>
          <p style={{ color: 'var(--text-dim)', marginTop: 4 }}>Skapa en stängning för helgdagar eller underhållsfönster.</p>
        </div>
      ) : (
        <div style={listWrap}>
          {blackouts.map(b => (
            <div key={b.id} style={rowStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{b.reason || '(ingen orsak angiven)'}</span>
                  <span style={badgeStyle(b.court_ids.length === 0 ? 'all' : 'some')}>
                    {b.court_ids.length === 0 ? 'Alla banor' : `${b.court_ids.length} bana${b.court_ids.length === 1 ? '' : 'r'}`}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {fmtRange(b.starts_at, b.ends_at)}
                </div>
                {b.court_names.length > 0 && b.court_ids.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                    {b.court_names.join(' · ')}
                  </div>
                )}
              </div>
              <button onClick={() => remove(b.id)} style={removeBtn}>Ta bort</button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={overlay} onClick={() => setShowForm(false)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Ny stängning</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label="Start">
                <input type="datetime-local" value={fStart} onChange={e => setFStart(e.target.value)} style={inp} />
              </Field>
              <Field label="Slut">
                <input type="datetime-local" value={fEnd} onChange={e => setFEnd(e.target.value)} style={inp} />
              </Field>
            </div>

            <Field label="Orsak">
              <input value={fReason} onChange={e => setFReason(e.target.value)} style={inp} placeholder="t.ex. Julstängt" />
            </Field>

            <div style={{ marginTop: 14 }}>
              <label style={lbl}>Omfattning (lämna tomt = alla banor)</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {courts.map(c => {
                  const on = fCourts.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCourt(c.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                        border: `1.5px solid ${on ? '#6366f1' : 'var(--border)'}`,
                        background: on ? '#eef2ff' : '#fff',
                        color: on ? '#4f46e5' : 'var(--text-muted)',
                      }}
                    >
                      {c.name}{on && ' ✓'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button className="btn btn-primary" onClick={save} disabled={saving} style={{ flex: 1 }}>
                {saving ? 'Skapar…' : 'Skapa stängning'}
              </button>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Avbryt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={lbl}>{label}</label>{children}</div>;
}

function fmtRange(startIso: string, endIso: string): string {
  const s = new Date(startIso); const e = new Date(endIso);
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  return `${s.toLocaleString('sv-SE', opts)} → ${e.toLocaleString('sv-SE', opts)}`;
}

function badgeStyle(kind: 'all' | 'some'): CSSProperties {
  return {
    padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.3,
    color: kind === 'all' ? '#b45309' : '#4f46e5',
    background: kind === 'all' ? '#fef3c7' : '#eef2ff',
  };
}

const listWrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
const rowStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 14, padding: 16,
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
  boxShadow: 'var(--shadow-xs)',
};
const removeBtn: CSSProperties = {
  padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  border: '1px solid var(--red-border)', background: 'var(--red-bg)', color: 'var(--red)',
  fontFamily: 'inherit',
};
const lbl: CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.7,
};
const inp: CSSProperties = {
  padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', width: '100%',
};
const overlay: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
};
const modal: CSSProperties = {
  background: 'var(--bg-card)', borderRadius: 18, padding: 28, width: 560,
  maxHeight: '90vh', overflow: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '1px solid var(--border)',
};

