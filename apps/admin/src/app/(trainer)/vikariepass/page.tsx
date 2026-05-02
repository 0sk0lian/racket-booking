'use client';

import { useEffect, useMemo, useState } from 'react';

const API = '/api';

type ScheduleItem = {
  type: 'booking' | 'course_session';
  id: string;
  date: string;
  start_hour: number;
  end_hour: number;
  title: string;
  court_name: string;
  booking_type: string;
};

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

export default function ReplacementPage() {
  const [trainerId, setTrainerId] = useState('');
  const [sessions, setSessions] = useState<ScheduleItem[]>([]);
  const [openAbsences, setOpenAbsences] = useState<Absence[]>([]);
  const [claimedAbsences, setClaimedAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    const me = await fetch(`${API}/users/me`).then((r) => r.json());
    if (!me.success || !me.data?.id || !me.data?.trainer_club_id) {
      flash('Kunde inte läsa tränarkonto eller klubbkoppling');
      setLoading(false);
      return;
    }

    const next14 = new Date();
    next14.setDate(next14.getDate() + 14);
    const from = new Date().toISOString().split('T')[0];
    const to = next14.toISOString().split('T')[0];

    setTrainerId(me.data.id);
    const [scheduleResponse, openResponse, allResponse] = await Promise.all([
      fetch(`${API}/admin/trainers/${me.data.id}/schedule?from=${from}&to=${to}`).then((r) => r.json()),
      fetch(`${API}/trainer-absences?clubId=${me.data.trainer_club_id}&status=open`).then((r) => r.json()),
      fetch(`${API}/trainer-absences?clubId=${me.data.trainer_club_id}&status=all`).then((r) => r.json()),
    ]);

    setSessions((scheduleResponse.data?.items ?? []).filter((item: ScheduleItem) => item.type === 'booking'));
    setOpenAbsences(openResponse.data ?? []);
    setClaimedAbsences((allResponse.data ?? []).filter((absence: Absence) => absence.claimed_by === me.data.id));
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const futureOwnSessions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return sessions.filter((session) => session.date >= today);
  }, [sessions]);

  const reportAbsence = async (bookingId: string) => {
    setReportingId(bookingId);
    const response = await fetch(`${API}/trainer-absences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, reason: reasons[bookingId] || null }),
    }).then((r) => r.json());

    if (response.success) {
      flash('Frånvaro registrerad. Passet är nu öppet för vikarie.');
      setReasons((current) => ({ ...current, [bookingId]: '' }));
      await loadData();
    } else {
      flash(response.error ?? 'Kunde inte registrera frånvaro');
    }
    setReportingId(null);
  };

  const claimAbsence = async (absenceId: string) => {
    setClaimingId(absenceId);
    const response = await fetch(`${API}/trainer-absences/${absenceId}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).then((r) => r.json());

    if (response.success) {
      flash('Passet är nu tilldelat dig.');
      await loadData();
    } else {
      flash(response.error ?? 'Kunde inte ta över passet');
    }
    setClaimingId(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Frånvaro och vikariepass</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>
            Sjukanmäl egna pass och ta över öppna vikariepass i din klubb.
          </p>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {loading ? (
        <div style={{ color: 'var(--text-dim)', padding: 40 }}>Laddar pass...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 20, marginBottom: 24 }}>
            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>Mina kommande pass</h2>
              {futureOwnSessions.length === 0 ? (
                <div style={{ color: 'var(--text-dim)' }}>Du har inga kommande bokade pass just nu.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {futureOwnSessions.map((session) => {
                    const key = session.id;
                    const alreadyOpen = openAbsences.some((absence) => absence.booking_id === session.id);
                    return (
                      <div key={session.id} style={{ padding: '12px 14px', background: 'var(--bg-body)', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{session.title}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                              {session.date} · {pad(session.start_hour)}:00-{pad(session.end_hour)}:00 · {session.court_name}
                            </div>
                          </div>
                          <span className={`badge ${alreadyOpen ? 'badge-yellow' : 'badge-green'}`}>
                            {alreadyOpen ? 'Öppet för vikarie' : 'Planerat'}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginTop: 10 }}>
                          <input
                            value={reasons[key] ?? ''}
                            onChange={(e) => setReasons((current) => ({ ...current, [key]: e.target.value }))}
                            disabled={alreadyOpen}
                            style={inputStyle}
                            placeholder="Valfri kommentar, till exempel feber eller vab"
                          />
                          <button
                            onClick={() => reportAbsence(session.id)}
                            disabled={alreadyOpen || reportingId === session.id}
                            style={dangerButtonStyle}
                          >
                            {reportingId === session.id ? 'Rapporterar...' : 'Sjukanmäl pass'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section style={panelStyle}>
              <h2 style={sectionTitleStyle}>Öppna vikariepass</h2>
              {openAbsences.filter((absence) => absence.trainer_id !== trainerId).length === 0 ? (
                <div style={{ color: 'var(--text-dim)' }}>Det finns inga öppna vikariepass att ta över just nu.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {openAbsences
                    .filter((absence) => absence.trainer_id !== trainerId)
                    .map((absence) => (
                      <div key={absence.id} style={{ padding: '12px 14px', background: 'var(--bg-body)', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{absence.trainer_name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                              {absence.session_date} · {pad(absence.session_start_hour)}:00-{pad(absence.session_end_hour)}:00
                            </div>
                            {absence.reason && (
                              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
                                Orsak: {absence.reason}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => claimAbsence(absence.id)}
                            disabled={claimingId === absence.id}
                            style={primaryButtonStyle}
                          >
                            {claimingId === absence.id ? 'Tar över...' : 'Ta över pass'}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </section>
          </div>

          <section style={panelStyle}>
            <h2 style={sectionTitleStyle}>Pass jag har tagit över</h2>
            {claimedAbsences.length === 0 ? (
              <div style={{ color: 'var(--text-dim)' }}>Du har inte tagit över några vikariepass ännu.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {claimedAbsences.map((absence) => (
                  <div key={absence.id} style={{ padding: '12px 14px', background: 'var(--bg-body)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{absence.session_date}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                          {pad(absence.session_start_hour)}:00-{pad(absence.session_end_hour)}:00 · Ursprunglig tränare: {absence.trainer_name}
                        </div>
                      </div>
                      <span className="badge badge-green">Övertaget</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function pad(value: number | null) {
  return String(value ?? 0).padStart(2, '0');
}

const panelStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: 20,
  boxShadow: 'var(--shadow-xs)',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  marginBottom: 14,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--bg-input)',
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'inherit',
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  border: 'none',
  borderRadius: 10,
  background: 'var(--accent-gradient)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const dangerButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  border: '1px solid rgba(239,68,68,0.25)',
  borderRadius: 10,
  background: 'rgba(239,68,68,0.08)',
  color: '#dc2626',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
