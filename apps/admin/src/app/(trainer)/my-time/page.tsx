'use client';

import { useEffect, useMemo, useState } from 'react';

const API = '/api';

type TimeReport = {
  id: string;
  date: string;
  hours: number;
  type: 'training' | 'admin' | 'event' | 'other';
  description: string | null;
  approved: boolean;
  booking_id: string | null;
  created_at: string;
};

const TYPE_LABELS: Record<TimeReport['type'], string> = {
  training: 'Träning',
  admin: 'Administration',
  event: 'Event',
  other: 'Övrigt',
};

export default function MyTimePage() {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = `${today.slice(0, 8)}01`;

  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [reports, setReports] = useState<TimeReport[]>([]);
  const [summary, setSummary] = useState({ totalHours: 0, approvedHours: 0, pendingHours: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState('');

  const [form, setForm] = useState({
    date: today,
    hours: '1',
    type: 'other',
    description: '',
  });

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  };

  const loadReports = async () => {
    setLoading(true);
    const response = await fetch(`${API}/users/me/time-reports?from=${from}&to=${to}`).then((r) => r.json());
    if (response.success) {
      setReports(response.data.reports ?? []);
      setSummary(response.data.summary ?? { totalHours: 0, approvedHours: 0, pendingHours: 0 });
    } else {
      flash(response.error ?? 'Kunde inte ladda dina tidrapporter');
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadReports();
  }, [from, to]);

  const groupedByStatus = useMemo(() => ({
    pending: reports.filter((report) => !report.approved),
    approved: reports.filter((report) => report.approved),
  }), [reports]);

  const saveManualReport = async () => {
    setSaving(true);
    const response = await fetch(`${API}/users/me/time-reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: form.date,
        hours: Number(form.hours),
        type: form.type,
        description: form.description || null,
      }),
    }).then((r) => r.json());

    if (response.success) {
      flash('Tidrapport sparad och väntar på godkännande');
      setForm((current) => ({ ...current, hours: '1', type: 'other', description: '' }));
      await loadReports();
    } else {
      flash(response.error ?? 'Kunde inte spara tidrapporten');
    }
    setSaving(false);
  };

  const syncDay = async () => {
    setSyncing(true);
    const response = await fetch(`${API}/users/me/time-reports/sync-schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: form.date }),
    }).then((r) => r.json());

    if (response.success) {
      const created = response.data?.created ?? 0;
      if (created === 0) {
        flash('Inga nya pass att synka för vald dag');
      } else {
        flash(`Synkade ${created} pass för ${form.date}`);
      }
      await loadReports();
    } else {
      flash(response.error ?? 'Kunde inte synka pass från schema');
    }
    setSyncing(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Mina timmar</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>
            Rapportera egna timmar och följ vad som är godkänt.
          </p>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginBottom: 20 }}>
        <SummaryCard label="Totalt" value={`${summary.totalHours}h`} accent="#6366f1" />
        <SummaryCard label="Godkänt" value={`${summary.approvedHours}h`} accent="#10b981" />
        <SummaryCard label="Väntar på godkännande" value={`${summary.pendingHours}h`} accent="#f59e0b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 20, marginBottom: 24 }}>
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Rapportera eller synka</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 12 }}>
            <Field label="Datum">
              <input type="date" value={form.date} onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Timmar">
              <input type="number" min="0.5" step="0.5" value={form.hours} onChange={(e) => setForm((current) => ({ ...current, hours: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Typ">
              <select value={form.type} onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))} style={inputStyle}>
                <option value="other">Övrigt</option>
                <option value="admin">Administration</option>
                <option value="training">Träning</option>
                <option value="event">Event</option>
              </select>
            </Field>
            <Field label="Snabbåtgärd">
              <button onClick={syncDay} disabled={syncing} style={{ ...actionButtonStyle, width: '100%' }}>
                {syncing ? 'Synkar...' : 'Synka dagens pass'}
              </button>
            </Field>
          </div>
          <Field label="Beskrivning">
            <input value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} style={inputStyle} placeholder="Till exempel planering, möte eller extra pass" />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button onClick={saveManualReport} disabled={saving} style={primaryButtonStyle}>
              {saving ? 'Sparar...' : 'Skicka tidrapport'}
            </button>
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Filter</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <Field label="Från">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Till">
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
            </Field>
          </div>
          <div style={{ marginTop: 18, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Automatiskt synkade pass skapas som väntande rapporter. Klubben godkänner dem innan de räknas som slutliga timmar.
          </div>
        </section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ReportList title="Väntar på godkännande" reports={groupedByStatus.pending} loading={loading} emptyText="Du har inga väntande tidrapporter." />
        <ReportList title="Godkända" reports={groupedByStatus.approved} loading={loading} emptyText="Du har inga godkända tidrapporter i valt intervall." />
      </div>
    </div>
  );
}

function ReportList({
  title,
  reports,
  loading,
  emptyText,
}: {
  title: string;
  reports: TimeReport[];
  loading: boolean;
  emptyText: string;
}) {
  return (
    <section style={panelStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      {loading ? (
        <div style={{ color: 'var(--text-dim)', padding: 20 }}>Laddar...</div>
      ) : reports.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', padding: 20 }}>{emptyText}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reports.map((report) => (
            <div key={report.id} style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--bg-body)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{report.date}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3 }}>
                    {TYPE_LABELS[report.type]}{report.description ? ` · ${report.description}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{report.hours}h</div>
                  <span className={`badge ${report.approved ? 'badge-green' : 'badge-yellow'}`}>
                    {report.approved ? 'Godkänd' : 'Väntar'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ ...panelStyle, padding: 18 }}>
      <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: accent }}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.7 }}>
        {label}
      </label>
      {children}
    </div>
  );
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
  padding: '10px 16px',
  border: 'none',
  borderRadius: 10,
  background: 'var(--accent-gradient)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const actionButtonStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--accent)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
