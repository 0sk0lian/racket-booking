'use client';
import { useEffect, useState } from 'react';

const API = '/api';

interface Court {
  id: string; club_id: string; name: string; sport_type: string;
  is_indoor: boolean; base_hourly_rate: number; hardware_relay_id: string | null;
  is_active: boolean;
}
interface Club { id: string; name: string; }

export default function CourtManagementPage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState('');
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  // New court form
  const [newName, setNewName] = useState('');
  const [newSport, setNewSport] = useState('padel');
  const [newIndoor, setNewIndoor] = useState(true);
  const [newRate, setNewRate] = useState('400');
  const [newRelay, setNewRelay] = useState('');

  useEffect(() => {
    fetch(`${API}/clubs`).then(r => r.json()).then(res => {
      setClubs(res.data || []);
      if (res.data?.length) setSelectedClub(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedClub) return;
    fetch(`${API}/courts?clubId=${selectedClub}`).then(r => r.json()).then(res => {
      setCourts(res.data || []);
      setLoading(false);
    });
  }, [selectedClub]);

  const reload = async () => {
    const res = await fetch(`${API}/courts?clubId=${selectedClub}`).then(r => r.json());
    setCourts(res.data || []);
  };

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const toggleActive = async (court: Court) => {
    await fetch(`${API}/admin/courts/${court.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !court.is_active }),
    });
    flash(`${court.name} ${court.is_active ? 'inaktiverades' : 'aktiverades'}`);
    await reload();
  };

  const updateRate = async (court: Court, rate: string) => {
    const val = Number(rate);
    if (isNaN(val) || val <= 0) return;
    await fetch(`${API}/admin/courts/${court.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseHourlyRate: val }),
    });
    flash(`${court.name} pris uppdaterades till ${val} SEK`);
    await reload();
  };

  const addCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API}/admin/courts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clubId: selectedClub, name: newName, sportType: newSport,
        isIndoor: newIndoor, baseHourlyRate: Number(newRate),
        hardwareRelayId: newRelay || null,
      }),
    });
    flash(`${newName} skapades`);
    setShowAdd(false);
    setNewName(''); setNewRate('400'); setNewRelay('');
    await reload();
  };

  return (
    <div>
      <div className="page-header">
        <h1>Hantera banor</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? '✕ Avbryt' : '+ Lägg till bana'}
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {/* Club selector */}
      <div style={{ marginBottom: 20 }}>
        <label style={label}>Klubb</label>
        <select value={selectedClub} onChange={e => { setSelectedClub(e.target.value); setLoading(true); }} style={input}>
          {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Add court form */}
      {showAdd && (
        <div className="form-card">
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Ny bana</h3>
          <form onSubmit={addCourt}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div><label style={label}>Namn</label><input value={newName} onChange={e => setNewName(e.target.value)} style={input} placeholder="Padelbana 4" required /></div>
              <div>
                <label style={label}>Sport</label>
                <select value={newSport} onChange={e => setNewSport(e.target.value)} style={input}>
                  <option value="padel">Padel</option><option value="tennis">Tennis</option>
                  <option value="squash">Squash</option><option value="badminton">Badminton</option>
                </select>
              </div>
              <div><label style={label}>Timpris (SEK)</label><input type="number" value={newRate} onChange={e => setNewRate(e.target.value)} style={input} min="0" required /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={label}>Inomhus / utomhus</label>
                <select value={newIndoor ? 'indoor' : 'outdoor'} onChange={e => setNewIndoor(e.target.value === 'indoor')} style={input}>
                  <option value="indoor">Inomhus</option><option value="outdoor">Utomhus</option>
                </select>
              </div>
              <div><label style={label}>Hårdvaru-relä-ID (IoT)</label><input value={newRelay} onChange={e => setNewRelay(e.target.value)} style={input} placeholder="Valfritt" /></div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Skapa bana</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Court list */}
      {loading ? <div className="loading">Laddar...</div> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Namn</th><th>Sport</th><th>Miljö</th><th>Pris/tim</th><th>IoT-enhet</th><th>Status</th><th>Åtgärder</th></tr></thead>
            <tbody>
              {courts.map(c => (
                <tr key={c.id} style={{ opacity: c.is_active ? 1 : 0.5 }}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td><span className={`badge ${c.sport_type === 'padel' ? 'badge-blue' : c.sport_type === 'tennis' ? 'badge-green' : 'badge-yellow'}`}>{c.sport_type}</span></td>
                  <td>{c.is_indoor ? 'Inomhus' : 'Utomhus'}</td>
                  <td>
                    <input
                      type="number" defaultValue={c.base_hourly_rate} min="0" style={{ ...input, width: 80, textAlign: 'right' as any }}
                      onBlur={e => { if (Number(e.target.value) !== c.base_hourly_rate) updateRate(c, e.target.value); }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    /> SEK
                  </td>
                  <td style={{ color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: 12 }}>{c.hardware_relay_id || '—'}</td>
                  <td>
                    <span className={`badge ${c.is_active ? 'badge-green' : 'badge-red'}`}>
                      {c.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-outline" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => toggleActive(c)}>
                      {c.is_active ? 'Inaktivera' : 'Aktivera'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.7px' };
const input: React.CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, width: '100%', transition: 'border-color 0.2s', outline: 'none' };
