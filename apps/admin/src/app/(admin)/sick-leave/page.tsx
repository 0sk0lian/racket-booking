'use client';

import { useEffect, useMemo, useState } from 'react';

const API = '/api';

type Club = { id: string; name: string };
type Trainer = { id: string; full_name: string; role: string; trainer_club_id: string | null };
type Absence = {
  id: string;
  trainer_id: string;
  trainer_name: string;
  booking_id: string | null;
  session_date: string;
  session_start_hour: number | null;
  session_end_hour: number | null;
  reason: string | null;
  status: 'open' | 'claimed' | 'cancelled';
  claimed_by: string | null;
  claimed_by_name: string | null;
};

export default function SickLeavePage() {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [clubId, setClubId] = useState('');
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [selectedReplacement, setSelectedReplacement] = useState<Record<string, string>>({});

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API}/clubs`).then((response) => response.json()),
      fetch(`${API}/users`).then((response) => response.json()),
    ]).then(([clubResponse, userResponse]) => {
      const nextClubs = clubResponse.data ?? [];
      setClubs(nextClubs);
      setTrainers((userResponse.data ?? []).filter((user: Trainer) => user.role === 'trainer'));
      if (nextClubs.length > 0) {
        setClubId(nextClubs[0].id);
      }
    });
  }, []);

  const loadAbsences = async () => {
    if (!clubId) return;
    setLoading(true);
    const response = await fetch(`${API}/trainer-absences?clubId=${clubId}&status=all`).then((r) => r.json());
    setAbsences(response.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void loadAbsences();
  }, [clubId]);

  const clubTrainers = useMemo(
    () => trainers.filter((trainer) => trainer.trainer_club_id === clubId),
    [trainers, clubId],
  );

  const openAbsences = absences.filter((absence) => absence.status === 'open');
  const handledAbsences = absences.filter((absence) => absence.status !== 'open');

  const assignReplacement = async (absence: Absence) => {
    const trainerId = selectedReplacement[absence.id];
    if (!trainerId) {
      flash('Välj en tränare först');
      return;
    }

    setAssigningId(absence.id);
    const response = await fetch(`${API}/trainer-absences/${absence.id}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trainerId }),
    }).then((r) => r.json());

    if (response.success) {
      flash('Vikarie tilldelad');
      await loadAbsences();
    } else {
      flash(response.error ?? 'Kunde inte tilldela vikarie');
    }
    setAssigningId(null);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Frånvaro och vikariepass</h1>
      </div>
      {toast && <div className="toast">{toast}</div>}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <Field label="Klubb">
          <select value={clubId} onChange={(e) => setClubId(e.target.value)} style={inputStyle}>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>{club.name}</option>
            ))}
          </select>
        </Field>
      </div>

      {loading ? (
        <div className="loading">Laddar frånvaro...</div>
      ) : (
        <>
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14, color: 'var(--red)' }}>
              Öppna vikariepass ({openAbsences.length})
            </h2>

            {openAbsences.length === 0 ? (
              <div style={emptyCardStyle}>Inga öppna vikariepass just nu.</div>
            ) : (
              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {openAbsences.map((absence) => {
                  const availableTrainers = clubTrainers.filter((trainer) => trainer.id !== absence.trainer_id);
                  return (
                    <div key={absence.id} style={{ ...cardStyle, border: '1px solid rgba(239,68,68,0.25)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{absence.trainer_name}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                            {absence.session_date} · {pad(absence.session_start_hour)}:00-{pad(absence.session_end_hour)}:00
                          </div>
                        </div>
                        <span className="badge badge-red">Öppen</span>
                      </div>
                      {absence.reason && (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                          Orsak: {absence.reason}
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
                        <select
                          value={selectedReplacement[absence.id] ?? ''}
                          onChange={(e) => setSelectedReplacement((current) => ({ ...current, [absence.id]: e.target.value }))}
                          style={inputStyle}
                        >
                          <option value="">Välj vikarie...</option>
                          {availableTrainers.map((trainer) => (
                            <option key={trainer.id} value={trainer.id}>{trainer.full_name}</option>
                          ))}
                        </select>
                        <button onClick={() => assignReplacement(absence)} disabled={assigningId === absence.id} className="btn btn-primary">
                          {assigningId === absence.id ? 'Tilldelar...' : 'Tilldela'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>Historik</h2>
            {handledAbsences.length === 0 ? (
              <div style={emptyCardStyle}>Ingen historik än.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Frånvarande tränare</th>
                      <th>Datum</th>
                      <th>Tid</th>
                      <th>Orsak</th>
                      <th>Status</th>
                      <th>Vikarie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {handledAbsences.map((absence) => (
                      <tr key={absence.id}>
                        <td style={{ fontWeight: 600 }}>{absence.trainer_name}</td>
                        <td>{absence.session_date}</td>
                        <td>{pad(absence.session_start_hour)}:00-{pad(absence.session_end_hour)}:00</td>
                        <td style={{ color: 'var(--text-muted)' }}>{absence.reason || '—'}</td>
                        <td>
                          <span className={`badge ${absence.status === 'claimed' ? 'badge-green' : 'badge-yellow'}`}>
                            {absence.status === 'claimed' ? 'Täcktes' : 'Stängd'}
                          </span>
                        </td>
                        <td>{absence.claimed_by_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function pad(value: number | null) {
  return String(value ?? 0).padStart(2, '0');
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 14,
  padding: 20,
  boxShadow: 'var(--shadow-xs)',
};

const emptyCardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 24,
  color: 'var(--text-dim)',
};

const inputStyle: React.CSSProperties = {
  padding: '9px 12px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
  fontSize: 13,
  width: '100%',
  fontFamily: 'inherit',
};
