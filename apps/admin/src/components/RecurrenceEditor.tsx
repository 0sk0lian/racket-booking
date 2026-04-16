'use client';
/**
 * RecurrenceEditor — edit a recurrence rule (frequency, interval, weekdays,
 * start/end dates, skip dates).
 *
 * Replaces the "repeat N weeks" number input on the Schedule page. Mirrors the
 * `RecurrenceRuleRow` fields on the API side 1:1 so values can be sent directly
 * to `POST /api/recurrence-rules`.
 */
import { useState, CSSProperties } from 'react';

export type Freq = 'once' | 'weekly' | 'biweekly' | 'monthly';

export interface RecurrenceValue {
  freq: Freq;
  intervalN: number;          // default 1; kept editable for monthly every-N-months
  weekdays: number[];         // 0=Sun..6=Sat
  startDate: string;          // YYYY-MM-DD
  endDate: string | null;     // null = open-ended
  skipDates: string[];        // YYYY-MM-DD
}

export interface RecurrenceEditorProps {
  value: RecurrenceValue;
  onChange: (v: RecurrenceValue) => void;
  /** Hide the "once" option (when the container represents inherently recurring items). */
  hideOnce?: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun visual order

export function RecurrenceEditor({ value, onChange, hideOnce = false }: RecurrenceEditorProps) {
  const [skipInput, setSkipInput] = useState('');

  const update = (patch: Partial<RecurrenceValue>) => onChange({ ...value, ...patch });

  const toggleWeekday = (d: number) => {
    const next = value.weekdays.includes(d)
      ? value.weekdays.filter(x => x !== d)
      : [...value.weekdays, d].sort((a, b) => a - b);
    update({ weekdays: next });
  };

  const addSkip = () => {
    if (!skipInput || value.skipDates.includes(skipInput)) return;
    update({ skipDates: [...value.skipDates, skipInput].sort() });
    setSkipInput('');
  };

  const removeSkip = (d: string) => update({ skipDates: value.skipDates.filter(x => x !== d) });

  const freqOptions: { key: Freq; label: string }[] = [
    ...(hideOnce ? [] : [{ key: 'once' as Freq, label: 'One time' }]),
    { key: 'weekly' as Freq, label: 'Weekly' },
    { key: 'biweekly' as Freq, label: 'Bi-weekly' },
    { key: 'monthly' as Freq, label: 'Monthly' },
  ];

  return (
    <div style={panelStyle}>
      <div style={sectionHdr}>Recurrence</div>

      {/* Frequency */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {freqOptions.map(opt => {
          const on = value.freq === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => update({ freq: opt.key })}
              style={{
                ...chipStyle,
                borderColor: on ? '#6366f1' : 'var(--border)',
                background: on ? '#eef2ff' : '#fff',
                color: on ? '#4f46e5' : 'var(--text-muted)',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Weekdays (only for weekly / biweekly) */}
      {(value.freq === 'weekly' || value.freq === 'biweekly') && (
        <div style={{ marginBottom: 12 }}>
          <label style={miniLbl}>On</label>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {DAY_ORDER.map(d => {
              const on = value.weekdays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleWeekday(d)}
                  style={{
                    width: 44, padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit',
                    border: `1.5px solid ${on ? '#6366f1' : 'var(--border)'}`,
                    background: on ? '#eef2ff' : '#fff',
                    color: on ? '#4f46e5' : 'var(--text-muted)',
                  }}
                >
                  {DAYS[d]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly interval */}
      {value.freq === 'monthly' && (
        <div style={{ marginBottom: 12 }}>
          <label style={miniLbl}>Every</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number"
              min={1}
              max={12}
              value={value.intervalN}
              onChange={e => update({ intervalN: Math.max(1, Number(e.target.value) || 1) })}
              style={{ ...inp, width: 80 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              month{value.intervalN === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      )}

      {/* Start / end dates */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={miniLbl}>Start date</label>
          <input type="date" value={value.startDate} onChange={e => update({ startDate: e.target.value })} style={inp} />
        </div>
        <div>
          <label style={miniLbl}>End date <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional)</span></label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="date"
              value={value.endDate ?? ''}
              onChange={e => update({ endDate: e.target.value || null })}
              style={inp}
            />
            {value.endDate && (
              <button
                type="button"
                onClick={() => update({ endDate: null })}
                style={{
                  padding: '9px 10px', fontSize: 11, borderRadius: 8, cursor: 'pointer',
                  border: '1px solid var(--border)', background: 'var(--bg-body)',
                  color: 'var(--text-muted)', fontFamily: 'inherit',
                }}
                title="Remove end date (open-ended)"
              >
                &times;
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Skip dates */}
      <div>
        <label style={miniLbl}>Skip dates <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(holidays, personal)</span></label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <input type="date" value={skipInput} onChange={e => setSkipInput(e.target.value)} style={inp} />
          <button
            type="button"
            onClick={addSkip}
            disabled={!skipInput}
            style={{
              padding: '9px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: skipInput ? 'pointer' : 'not-allowed',
              border: '1px solid var(--border)', background: skipInput ? '#eef2ff' : 'var(--bg-body)',
              color: skipInput ? '#4f46e5' : 'var(--text-dim)', fontFamily: 'inherit',
            }}
          >
            Add skip
          </button>
        </div>
        {value.skipDates.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {value.skipDates.map(d => (
              <span
                key={d}
                onClick={() => removeSkip(d)}
                style={{
                  padding: '3px 8px', borderRadius: 10, fontSize: 11,
                  background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a',
                  cursor: 'pointer',
                }}
                title="Remove"
              >
                {d} &times;
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={summaryBox}>
        {summarize(value)}
      </div>
    </div>
  );
}

function summarize(v: RecurrenceValue): string {
  if (v.freq === 'once') return `Once on ${v.startDate}`;
  const days = v.weekdays.length
    ? v.weekdays.slice().sort((a, b) => {
        const am = a === 0 ? 7 : a; const bm = b === 0 ? 7 : b;
        return am - bm;
      }).map(d => DAYS[d]).join(', ')
    : '(no weekdays)';
  const base = v.freq === 'weekly' ? `Every week on ${days}`
    : v.freq === 'biweekly' ? `Every other week on ${days}`
    : `Every ${v.intervalN} month${v.intervalN === 1 ? '' : 's'}`;
  const range = v.endDate ? `from ${v.startDate} to ${v.endDate}` : `starting ${v.startDate} (open-ended)`;
  const skips = v.skipDates.length ? `, skipping ${v.skipDates.length}` : '';
  return `${base}, ${range}${skips}`;
}

const panelStyle: CSSProperties = {
  background: 'var(--bg-body)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 14,
};
const sectionHdr: CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10,
};
const miniLbl: CSSProperties = {
  display: 'block', fontSize: 10.5, fontWeight: 600, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
};
const chipStyle: CSSProperties = {
  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  border: '1.5px solid var(--border)', transition: 'all 0.15s', fontFamily: 'inherit',
};
const inp: CSSProperties = {
  padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', width: '100%',
};
const summaryBox: CSSProperties = {
  marginTop: 12, padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 8,
  fontSize: 11.5, color: 'var(--text-muted)', fontStyle: 'italic',
  border: '1px dashed var(--border)',
};
