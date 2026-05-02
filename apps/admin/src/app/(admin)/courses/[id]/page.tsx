'use client';
/**
 * Course detail - admin view with tabs: Oversikt | Anmalningar | Sessioner
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const API = '/api';

interface Course {
  id: string;
  club_id: string;
  name: string;
  description: string | null;
  sport_type: string;
  category: string;
  court_name: string;
  trainer_name: string | null;
  day_of_week: number;
  start_hour: number;
  end_hour: number;
  term_start: string;
  term_end: string;
  skip_dates: string[];
  max_participants: number | null;
  price_total: number | null;
  price_per_session: number | null;
  registration_status: string;
  visibility: string;
  status: string;
  registration_form_id: string | null;
}

interface Registration {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string | null;
  user_phone: string | null;
  status: string;
  payment_status: string;
  applied_at: string;
  answers: Record<string, unknown>;
  pass_count: number;
  invoice_id: string | null;
  invoice_status: string | null;
  invoice_due_date: string | null;
  invoice_amount: number | null;
}

interface Session {
  id: string;
  date: string;
  start_hour: number;
  end_hour: number;
  court_name: string | null;
  trainer_name: string | null;
  status: string;
  booking_id: string | null;
}

interface FormOption {
  id: string;
  title: string;
  status: string;
}

type Tab = 'overview' | 'registrations' | 'sessions';
const DAY_NAMES = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

function humanAnswer(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nej';
  if (value == null || value === '') return '—';
  return String(value);
}

function answerText(answers: Record<string, unknown>) {
  return Object.entries(answers ?? {})
    .filter(([, value]) => value !== '' && value !== false && value != null)
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${humanAnswer(value)}`);
}

function preferenceScore(registration: Registration) {
  const day = String(registration.answers.preferred_day ?? registration.answers.onskad_dag ?? registration.answers.önskad_dag ?? '').toLowerCase();
  const time = String(registration.answers.preferred_time ?? registration.answers.preferred_timeslot ?? registration.answers.onskad_tid ?? registration.answers.önskad_tid ?? '').toLowerCase();
  return `${day} ${time}`.trim();
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [forms, setForms] = useState<FormOption[]>([]);
  const [selectedFormId, setSelectedFormId] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [syncingPlanner, setSyncingPlanner] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [linkingForm, setLinkingForm] = useState(false);
  const flash = (message: string) => { setToast(message); setTimeout(() => setToast(''), 4000); };

  const load = async () => {
    setLoading(true);
    const courseResponse = await fetch(`${API}/courses/${id}`).then((r) => r.json());
    const loadedCourse = courseResponse.data ?? null;
    setCourse(loadedCourse);

    const [registrationResponse, sessionResponse, formsResponse] = await Promise.all([
      fetch(`${API}/courses/${id}/registrations`).then((r) => r.json()),
      fetch(`${API}/courses/${id}/sessions`).then((r) => r.json()),
      loadedCourse?.club_id
        ? fetch(`${API}/registration-forms?clubId=${loadedCourse.club_id}`).then((r) => r.json())
        : Promise.resolve({ data: [] }),
    ]);

    setRegistrations(registrationResponse.data ?? []);
    setSessions(sessionResponse.data ?? []);
    setForms((formsResponse.data ?? []).map((form: any) => ({ id: form.id, title: form.title, status: form.status })));
    setSelectedFormId(loadedCourse?.registration_form_id ?? '');
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  const approveRegs = async (ids: string[], status: string) => {
    await fetch(`${API}/courses/${id}/registrations`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, status }),
    });
    flash(`${ids.length} ${status === 'approved' ? 'godkända' : 'avvisade'}`);
    load();
  };

  const generateSessions = async () => {
    const response = await fetch(`${API}/courses/${id}/sessions/generate`, { method: 'POST' }).then((r) => r.json());
    if (response.success) {
      flash(`${response.data.generated} sessioner skapade`);
      load();
      return;
    }
    flash(response.error ?? 'Fel');
  };

  const syncApprovedToPlanner = async () => {
    setSyncingPlanner(true);
    const response = await fetch(`${API}/courses/${id}/sync-planner`, { method: 'POST' }).then((r) => r.json());
    setSyncingPlanner(false);
    if (!response.success) return flash(response.error ?? 'Kunde inte synka till träningsplaneraren');
    flash(response.data.created
      ? `Synkat: ${response.data.totalPlayers} spelare placerade i träningsplaneraren`
      : `Träningsplaneraren uppdaterad (+${response.data.addedPlayers} spelare, ${response.data.totalPlayers} totalt)`);
    load();
  };

  const setPaymentStatus = async (ids: string[], paymentStatus: 'unpaid' | 'paid' | 'refunded') => {
    if (ids.length === 0) return;
    setBillingBusy(true);
    await fetch(`${API}/courses/${id}/registrations`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, paymentStatus }),
    });
    setBillingBusy(false);
    flash(paymentStatus === 'paid' ? `${ids.length} markerade som betalda` : `${ids.length} markerade som ${paymentStatus}`);
    load();
  };

  const updateStatus = async (status: string) => {
    await fetch(`${API}/courses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    flash(`Status ändrad till ${status}`);
    load();
  };

  const deleteRegistration = async (registrationId: string) => {
    if (!confirm('Ta bort denna anmälan? Detta kan inte ångras.')) return;
    const response = await fetch(`${API}/courses/${id}/registrations?registrationId=${registrationId}`, { method: 'DELETE' }).then((r) => r.json());
    if (response.success) {
      flash('Anmälan borttagen');
      load();
      return;
    }
    flash(response.error ?? 'Kunde inte ta bort');
  };

  const updateRegStatus = async (registrationStatus: string) => {
    await fetch(`${API}/courses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationStatus }),
    });
    flash(`Anmälan ${registrationStatus === 'open' ? 'öppnad' : registrationStatus === 'closed' ? 'stängd' : registrationStatus}`);
    load();
  };

  const linkForm = async () => {
    setLinkingForm(true);
    await fetch(`${API}/courses/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationFormId: selectedFormId || null }),
    });
    setLinkingForm(false);
    flash(selectedFormId ? 'Ansökningsformulär kopplat till kursen' : 'Ansökningsformulär bortkopplat');
    load();
  };

  const createInvoices = async (registrationIds: string[]) => {
    if (registrationIds.length === 0) return;
    setBillingBusy(true);
    const response = await fetch(`${API}/courses/${id}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationIds }),
    }).then((r) => r.json());
    setBillingBusy(false);

    if (!response.success && (!response.data?.created || response.data.created.length === 0)) {
      flash(response.error ?? 'Kunde inte skapa fakturor');
      return;
    }

    const createdCount = response.data?.created?.length ?? 0;
    const skippedCount = response.data?.skipped?.length ?? 0;
    flash(skippedCount > 0 ? `${createdCount} fakturor skapade, ${skippedCount} hoppades över` : `${createdCount} fakturor skapade`);
    load();
  };

  const markInvoicesPaid = async (rows: Registration[]) => {
    const invoiceIds = rows.map((row) => row.invoice_id).filter(Boolean) as string[];
    if (invoiceIds.length === 0) return;
    setBillingBusy(true);
    await Promise.all(invoiceIds.map((invoiceId) => fetch(`${API}/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid', paidMethod: 'manual' }),
    })));
    setBillingBusy(false);
    flash(`${invoiceIds.length} fakturor markerade som betalda`);
    load();
  };

  const pending = useMemo(
    () => registrations.filter((registration) => registration.status === 'pending').sort((a, b) => preferenceScore(a).localeCompare(preferenceScore(b)) || a.applied_at.localeCompare(b.applied_at)),
    [registrations],
  );
  const approved = registrations.filter((registration) => registration.status === 'approved');
  const approvedUnpaid = approved.filter((registration) => registration.payment_status !== 'paid');
  const approvedWithoutInvoice = approved.filter((registration) => !registration.invoice_id);
  const estimatedToBill = approvedUnpaid.reduce((sum, registration) => sum + Number(registration.invoice_amount ?? 0), 0);
  const linkedForm = forms.find((form) => form.id === course?.registration_form_id) ?? null;

  if (loading) return <div className="loading">Laddar kurs...</div>;
  if (!course) return <div className="empty-state"><h3>Kurs hittades inte</h3></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <Link href="/courses" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 12 }}>? Kurser</Link>
          <h1 style={{ marginTop: 4 }}>{course.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={syncApprovedToPlanner} disabled={syncingPlanner}>
            {syncingPlanner ? 'Synkar...' : 'Placera i träningsplanerare'}
          </button>
          {course.status === 'draft' && <button className="btn btn-primary" onClick={() => updateStatus('active')}>Aktivera</button>}
          {course.status === 'active' && <button className="btn btn-outline" onClick={() => updateStatus('completed')}>Avsluta</button>}
          {course.registration_status !== 'open' && <button className="btn btn-outline" onClick={() => updateRegStatus('open')}>Öppna registrering</button>}
          {course.registration_status === 'open' && <button className="btn btn-outline" onClick={() => updateRegStatus('closed')}>Stäng registrering</button>}
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {(['overview', 'registrations', 'sessions'] as Tab[]).map((item) => (
          <button key={item} onClick={() => setTab(item)} style={{
            padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: tab === item ? 700 : 500,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            border: `1.5px solid ${tab === item ? '#6366f1' : 'var(--border)'}`,
            background: tab === item ? '#eef2ff' : 'var(--bg-card)',
            color: tab === item ? '#4f46e5' : 'var(--text-muted)',
          }}>
            {{ overview: 'Översikt', registrations: `Anmälningar (${registrations.length})`, sessions: `Sessioner (${sessions.length})` }[item]}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <InfoCard label="Schema" value={`${DAY_NAMES[course.day_of_week]} ${String(course.start_hour).padStart(2, '0')}:00–${String(course.end_hour).padStart(2, '0')}:00`} />
          <InfoCard label="Bana" value={course.court_name ?? '?'} />
          <InfoCard label="Tränare" value={course.trainer_name ?? 'Ingen'} />
          <InfoCard label="Termin" value={`${course.term_start} ? ${course.term_end}`} />
          <InfoCard label="Deltagare" value={`${approved.length}/${course.max_participants ?? '8'}`} />
          <InfoCard label="Pris" value={course.price_total ? `${course.price_total} SEK` : course.price_per_session ? `${course.price_per_session} SEK/pass` : 'Gratis'} />
          <InfoCard label="Sport" value={course.sport_type} />
          <InfoCard label="Kategori" value={course.category} />
          <div style={{ gridColumn: 'span 2', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Ansökningsformulär</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={selectedFormId} onChange={(event) => setSelectedFormId(event.target.value)} style={inp}>
                <option value="">Inget formulär kopplat</option>
                {forms.map((form) => (
                  <option key={form.id} value={form.id}>{form.title} ({form.status})</option>
                ))}
              </select>
              <button className="btn btn-outline" onClick={linkForm} disabled={linkingForm}>{linkingForm ? 'Sparar...' : 'Spara val'}</button>
              <Link href="/registration-forms" style={{ fontSize: 12, color: 'var(--accent)' }}>Hantera formulär ?</Link>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
              {linkedForm ? `Kopplat formulär: ${linkedForm.title}` : 'Ingen särskild ansökningsblankett är kopplad till kursen ännu.'}
            </div>
          </div>
          {course.description && <div style={{ gridColumn: 'span 2', padding: 16, background: 'var(--bg-body)', borderRadius: 10, fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>{course.description}</div>}
        </div>
      )}

      {tab === 'registrations' && (
        <div>
          {pending.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700 }}>Väntande ({pending.length})</h3>
                <button className="btn btn-primary" onClick={() => approveRegs(pending.map((row) => row.id), 'approved')} style={{ padding: '6px 16px', fontSize: 12 }}>Godkänn alla</button>
              </div>
              {pending.map((registration) => (
                <RegistrationRow
                  key={registration.id}
                  registration={registration}
                  onApprove={() => approveRegs([registration.id], 'approved')}
                  onReject={() => approveRegs([registration.id], 'rejected')}
                  onDelete={() => deleteRegistration(registration.id)}
                />
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Godkända ({approved.length})</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Fakturaklara: {approvedWithoutInvoice.length} · Obetalda: {approvedUnpaid.length}{estimatedToBill > 0 ? ` (${estimatedToBill} SEK)` : ''}
              </span>
              <button className="btn btn-outline" onClick={() => createInvoices(approvedWithoutInvoice.map((row) => row.id))} disabled={billingBusy || approvedWithoutInvoice.length === 0} style={{ padding: '6px 14px', fontSize: 12 }}>
                {billingBusy ? 'Arbetar...' : 'Skapa fakturor'}
              </button>
              <button className="btn btn-outline" onClick={() => markInvoicesPaid(approvedUnpaid.filter((row) => !!row.invoice_id))} disabled={billingBusy || approvedUnpaid.filter((row) => !!row.invoice_id).length === 0} style={{ padding: '6px 14px', fontSize: 12 }}>
                {billingBusy ? 'Arbetar...' : 'Markera fakturor som betalda'}
              </button>
            </div>
          </div>

          {approved.length === 0 ? <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Inga godkända deltagare ännu.</p> : approved.map((registration) => (
            <RegistrationRow
              key={registration.id}
              registration={registration}
              approved
              onCreateInvoice={!registration.invoice_id ? () => createInvoices([registration.id]) : undefined}
              onMarkPaid={registration.invoice_id && registration.invoice_status !== 'paid' ? () => markInvoicesPaid([registration]) : undefined}
              onMarkUnpaid={registration.payment_status === 'paid' ? () => setPaymentStatus([registration.id], 'unpaid') : undefined}
              onDelete={() => deleteRegistration(registration.id)}
            />
          ))}

          {registrations.filter((registration) => registration.status === 'waitlisted').length > 0 && (
            <>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 20, marginBottom: 10 }}>Väntelista</h3>
              {registrations.filter((registration) => registration.status === 'waitlisted').map((registration) => (
                <RegistrationRow key={registration.id} registration={registration} onApprove={() => approveRegs([registration.id], 'approved')} onDelete={() => deleteRegistration(registration.id)} />
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'sessions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>{sessions.length} sessioner</h3>
            <button className="btn btn-primary" onClick={generateSessions}>Generera sessioner</button>
          </div>
          {sessions.length === 0 ? (
            <div className="empty-state"><p style={{ fontSize: 42, marginBottom: 8 }}>??</p><h3>Inga sessioner</h3><p style={{ color: 'var(--text-dim)' }}>Klicka "Generera sessioner" för att skapa dem från kursens schema.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sessions.map((session) => (
                <div key={session.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px' }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      {new Date(session.date + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>
                      {String(session.start_hour).padStart(2, '0')}:00–{String(session.end_hour).padStart(2, '0')}:00
                    </span>
                    {session.court_name && <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8 }}>{session.court_name}</span>}
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: session.status === 'scheduled' ? '#ecfdf5' : session.status === 'cancelled' ? '#fef2f2' : '#eef2ff', color: session.status === 'scheduled' ? '#059669' : session.status === 'cancelled' ? '#dc2626' : '#4f46e5' }}>{({ scheduled: 'Schemalagd', confirmed: 'Bekräftad', pending: 'Väntande', cancelled: 'Avbokad', completed: 'Avslutad' } as Record<string, string>)[session.status] ?? session.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, textTransform: 'capitalize' }}>{value}</div>
    </div>
  );
}

function RegistrationRow({
  registration,
  onApprove,
  onReject,
  approved,
  onCreateInvoice,
  onMarkPaid,
  onMarkUnpaid,
  onDelete,
}: {
  registration: Registration;
  onApprove?: () => void;
  onReject?: () => void;
  approved?: boolean;
  onCreateInvoice?: () => void;
  onMarkPaid?: () => void;
  onMarkUnpaid?: () => void;
  onDelete?: () => void;
}) {
  const answers = answerText(registration.answers);

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{registration.user_name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {registration.user_email}{registration.user_phone ? ` · ${registration.user_phone}` : ''} · {new Date(registration.applied_at).toLocaleDateString('sv-SE')}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: '#eef2ff', color: '#4f46e5' }}>{registration.pass_count} pass i planering</span>
            <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: registration.payment_status === 'paid' ? '#ecfdf5' : '#fef3c7', color: registration.payment_status === 'paid' ? '#059669' : '#b45309' }}>
              {({ paid: 'Betald', unpaid: 'Obetald', refunded: 'Återbetald' } as Record<string, string>)[registration.payment_status] ?? registration.payment_status}
            </span>
            {registration.invoice_id && <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: registration.invoice_status === 'paid' ? '#ecfdf5' : '#f8fafc', color: registration.invoice_status === 'paid' ? '#059669' : '#475569' }}>Faktura {registration.invoice_status ?? 'skapad'}{registration.invoice_amount ? ` · ${registration.invoice_amount} SEK` : ''}</span>}
          </div>
          {answers.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {answers.map((answer) => (
                <span key={answer} style={{ padding: '3px 8px', borderRadius: 999, fontSize: 11, background: 'var(--bg-body)', color: 'var(--text-muted)' }}>{answer}</span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!approved && onApprove && <button onClick={onApprove} style={greenBtn}>Godkänn</button>}
          {!approved && onReject && <button onClick={onReject} style={redBtn}>Avvisa</button>}
          {approved && <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#ecfdf5', color: '#059669' }}>? Godkänd</span>}
          {approved && onCreateInvoice && <button onClick={onCreateInvoice} style={blueBtn}>Skapa faktura</button>}
          {approved && onMarkPaid && <button onClick={onMarkPaid} style={greenBtn}>Markera betald</button>}
          {approved && onMarkUnpaid && <button onClick={onMarkUnpaid} style={yellowBtn}>Markera obetald</button>}
          {onDelete && <button onClick={onDelete} style={redBtn}>Ta bort</button>}
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: '9px 12px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
  fontSize: 13,
  minWidth: 260,
  fontFamily: 'inherit',
};

const greenBtn: React.CSSProperties = { padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid #a7f3d0', background: '#ecfdf5', color: '#059669', cursor: 'pointer', fontFamily: 'inherit' };
const redBtn: React.CSSProperties = { padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontFamily: 'inherit' };
const blueBtn: React.CSSProperties = { padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid #c7d2fe', background: '#eef2ff', color: '#4f46e5', cursor: 'pointer', fontFamily: 'inherit' };
const yellowBtn: React.CSSProperties = { padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid #fde68a', background: '#fefce8', color: '#a16207', cursor: 'pointer', fontFamily: 'inherit' };
