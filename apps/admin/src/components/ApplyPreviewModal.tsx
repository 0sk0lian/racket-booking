'use client';
/**
 * ApplyPreviewModal — dry-run before committing a recurrence rule to the schedule.
 *
 * Workflow:
 *   1. Open with a rule id + suggested date range.
 *   2. Calls POST /api/recurrence-rules/:id/preview — shows per-date verdict
 *      (create / blackout / conflict).
 *   3. User clicks "Apply" → POST /:id/materialize; modal flips to a result state
 *      with an Undo button tied to the returned batch_id.
 *   4. Undo → DELETE /api/apply-batches/:batchId, closes modal.
 *
 * Replaces the "enter dates, click apply, get a number" UX on the old training
 * planner.
 */
import { useEffect, useState, CSSProperties } from 'react';

const API = '/api';

export interface PreviewInstance {
  date: string;
  start_iso: string; end_iso: string;
  start_hour: number; end_hour: number;
  court_id: string;
  reason?: string | null;
  conflicting_booking_id?: string;
  blackout_id?: string;
}

export interface PreviewData {
  rule_id: string;
  instances: PreviewInstance[];
  conflicts: PreviewInstance[];
  blackouts: PreviewInstance[];
  skipped_dates: string[];
}

export interface ApplyPreviewModalProps {
  ruleId: string;
  ruleTitle: string;
  initialFrom: string;
  initialTo: string;
  onClose: () => void;
  onApplied?: (result: { created: number; batch_id: string }) => void;
}

type Phase = 'loading' | 'preview' | 'applying' | 'result' | 'undoing' | 'error';

interface Verdict { date: string; hour: string; kind: 'create' | 'blackout' | 'conflict' | 'skip'; note: string; }

export function ApplyPreviewModal({ ruleId, ruleTitle, initialFrom, initialTo, onClose, onApplied }: ApplyPreviewModalProps) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [phase, setPhase] = useState<Phase>('loading');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: number; batch_id: string; blackouts: number; conflicts: number } | null>(null);
  const [undoMessage, setUndoMessage] = useState('');

  const reload = async () => {
    setPhase('loading'); setError('');
    try {
      const r = await fetch(`${API}/recurrence-rules/${ruleId}/preview?from=${from}&to=${to}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      }).then(r => r.json());
      if (!r.success) throw new Error(r.error ?? 'Preview failed');
      setPreview(r.data);
      setPhase('preview');
    } catch (e: any) {
      setError(e.message); setPhase('error');
    }
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ruleId]);

  const verdicts: Verdict[] = preview
    ? [
        ...preview.instances.map<Verdict>(i => ({ date: i.date, hour: `${pad(i.start_hour)}:00–${pad(i.end_hour)}:00`, kind: 'create', note: 'Will create booking' })),
        ...preview.blackouts.map<Verdict>(b => ({ date: b.date, hour: `${pad(b.start_hour)}:00–${pad(b.end_hour)}:00`, kind: 'blackout', note: `Closure: ${b.reason ?? '(no reason)'}` })),
        ...preview.conflicts.map<Verdict>(c => ({ date: c.date, hour: `${pad(c.start_hour)}:00–${pad(c.end_hour)}:00`, kind: 'conflict', note: 'Slot already booked' })),
        ...preview.skipped_dates.map<Verdict>(d => ({ date: d, hour: '—', kind: 'skip', note: 'Listed in rule skip_dates' })),
      ].sort((a, b) => (a.date + a.hour).localeCompare(b.date + b.hour))
    : [];

  const apply = async () => {
    setPhase('applying');
    try {
      const r = await fetch(`${API}/recurrence-rules/${ruleId}/materialize?from=${from}&to=${to}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      }).then(r => r.json());
      if (!r.success) throw new Error(r.error ?? 'Apply failed');
      const summary = { created: r.data.created, batch_id: r.data.batch_id, blackouts: r.data.blackouts.length, conflicts: r.data.conflicts.length };
      setResult(summary);
      setPhase('result');
      onApplied?.(summary);
    } catch (e: any) {
      setError(e.message); setPhase('error');
    }
  };

  const undo = async () => {
    if (!result) return;
    setPhase('undoing');
    try {
      const r = await fetch(`${API}/apply-batches/${result.batch_id}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      }).then(r => r.json());
      if (!r.success) throw new Error(r.error ?? 'Undo failed');
      setUndoMessage(`Undone — ${r.data.cancelled} booking(s) cancelled`);
      setPhase('result');
    } catch (e: any) {
      setError(e.message); setPhase('error');
    }
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Apply to period</h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{ruleTitle}</div>
          </div>
          <button onClick={onClose} style={closeBtn}>&times;</button>
        </div>

        {/* Date window — editable during preview */}
        {phase !== 'result' && phase !== 'applying' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, marginBottom: 16 }}>
            <div>
              <label style={lbl}>From</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>To</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inp} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={reload} className="btn btn-outline" style={{ padding: '9px 16px' }}>Refresh</button>
            </div>
          </div>
        )}

        {/* Phase content */}
        {phase === 'loading' && <div className="loading">Computing preview…</div>}
        {phase === 'error' && (
          <div style={errBox}>
            <strong>Error:</strong> {error}
            <div style={{ marginTop: 8 }}><button onClick={reload} className="btn btn-outline">Retry</button></div>
          </div>
        )}

        {phase === 'preview' && preview && (
          <>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 12 }}>
              <Badge color="#059669" bg="#ecfdf5" label={`${preview.instances.length} create`} />
              {preview.blackouts.length > 0 && <Badge color="#b45309" bg="#fef3c7" label={`${preview.blackouts.length} blackout`} />}
              {preview.conflicts.length > 0 && <Badge color="#dc2626" bg="#fef2f2" label={`${preview.conflicts.length} conflict`} />}
              {preview.skipped_dates.length > 0 && <Badge color="#6b7280" bg="#f3f4f6" label={`${preview.skipped_dates.length} skip`} />}
            </div>

            <div style={tableWrap}>
              <div style={tableHdr}>
                <span style={colDate}>Date</span>
                <span style={colHour}>Time</span>
                <span style={colKind}>Status</span>
                <span style={{ flex: 1 }}>Note</span>
              </div>
              {verdicts.length === 0 && <div style={{ padding: 14, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>No matching dates in this range.</div>}
              {verdicts.map((v, i) => (
                <div key={`${v.date}_${v.hour}_${i}`} style={{ ...tableRow, background: i % 2 ? 'var(--bg-body)' : 'transparent' }}>
                  <span style={colDate}>{v.date}</span>
                  <span style={colHour}>{v.hour}</span>
                  <span style={colKind}><VerdictPill kind={v.kind} /></span>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}>{v.note}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button
                onClick={apply}
                disabled={preview.instances.length === 0}
                className="btn btn-primary"
                style={{ flex: 1, opacity: preview.instances.length === 0 ? 0.5 : 1 }}
              >
                Apply {preview.instances.length} booking{preview.instances.length === 1 ? '' : 's'}
              </button>
              <button onClick={onClose} className="btn btn-outline">Cancel</button>
            </div>
          </>
        )}

        {phase === 'applying' && <div className="loading">Creating bookings…</div>}

        {phase === 'result' && result && (
          <div style={resultBox}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#059669', marginBottom: 6 }}>
              Applied — {result.created} booking{result.created === 1 ? '' : 's'} created
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              {result.blackouts > 0 && `${result.blackouts} blackout(s) skipped · `}
              {result.conflicts > 0 && `${result.conflicts} conflict(s) skipped · `}
              Batch <code>{result.batch_id.slice(0, 8)}…</code>
            </div>
            {undoMessage && (
              <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 12 }}>{undoMessage}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              {!undoMessage && (
                <button onClick={undo} className="btn btn-outline" style={{ color: '#dc2626', borderColor: '#fecaca' }}>
                  Undo this apply
                </button>
              )}
              <button onClick={onClose} className="btn btn-primary" style={{ flex: 1 }}>Done</button>
            </div>
          </div>
        )}

        {phase === 'undoing' && <div className="loading">Undoing…</div>}
      </div>
    </div>
  );
}

function pad(n: number): string { return String(n).padStart(2, '0'); }

function VerdictPill({ kind }: { kind: Verdict['kind'] }) {
  const map: Record<Verdict['kind'], { label: string; color: string; bg: string }> = {
    create:   { label: 'Create',   color: '#059669', bg: '#ecfdf5' },
    blackout: { label: 'Blackout', color: '#b45309', bg: '#fef3c7' },
    conflict: { label: 'Conflict', color: '#dc2626', bg: '#fef2f2' },
    skip:     { label: 'Skip',     color: '#6b7280', bg: '#f3f4f6' },
  };
  const c = map[kind];
  return (
    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10.5, fontWeight: 700, color: c.color, background: c.bg, textTransform: 'uppercase', letterSpacing: 0.3 }}>
      {c.label}
    </span>
  );
}

function Badge({ color, bg, label }: { color: string; bg: string; label: string }) {
  return <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, color, background: bg }}>{label}</span>;
}

// ─── Styles ─────────────────────────────────────────────────────
const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 };
const modal: CSSProperties = { background: 'var(--bg-card)', borderRadius: 18, padding: 28, width: 720, maxHeight: '92vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '1px solid var(--border)' };
const closeBtn: CSSProperties = { background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px' };
const lbl: CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.7 };
const inp: CSSProperties = { padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', width: '100%' };
const tableWrap: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card)', maxHeight: 340, overflowY: 'auto' };
const tableHdr: CSSProperties = { display: 'flex', gap: 8, padding: '10px 14px', background: 'var(--bg-body)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 };
const tableRow: CSSProperties = { display: 'flex', gap: 8, padding: '8px 14px', alignItems: 'center', borderBottom: '1px solid var(--border)' };
const colDate: CSSProperties = { width: 100, fontSize: 12, fontWeight: 600, color: 'var(--text)' };
const colHour: CSSProperties = { width: 110, fontSize: 11.5, color: 'var(--text-muted)' };
const colKind: CSSProperties = { width: 92 };
const errBox: CSSProperties = { padding: 14, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#b91c1c', fontSize: 13 };
const resultBox: CSSProperties = { padding: 18, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12 };
