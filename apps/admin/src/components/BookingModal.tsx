'use client';
/**
 * BookingModal — unified create / edit dialog for all four booking types.
 *
 * Replaces the split between the inline "create pane" on the Schedule page and
 * the "edit modal" that lived alongside it: same fields, same type tabs, one
 * code path. The recurrence editor (Phase 3) will slot in as an additional tab
 * — until then, contracts still use the simple "repeat N weeks" number input.
 *
 * Designed to be fed by callers who hold state in parent pages.
 */
import { useEffect, useState, CSSProperties, ReactNode } from 'react';
import { PlayerPicker, PickerUser, PickerGroup } from './PlayerPicker';
import { AttendanceBoard } from './AttendanceBoard';

export type BType = 'regular' | 'training' | 'contract' | 'event';

export const TYPE_CONFIG: Record<BType, { bg: string; border: string; text: string; label: string; icon: string }> = {
  regular:  { bg: '#ecfdf5', border: '#10b981', text: '#059669', label: 'Booking',  icon: 'B' },
  training: { bg: '#eef2ff', border: '#6366f1', text: '#4f46e5', label: 'Training', icon: 'T' },
  contract: { bg: '#fef3c7', border: '#f59e0b', text: '#b45309', label: 'Contract', icon: 'C' },
  event:    { bg: '#fce7f3', border: '#ec4899', text: '#be185d', label: 'Event',    icon: 'E' },
};

export interface TrainerOpt { id: string; full_name: string; hourly_rate: number; }
export interface BookingSummary {
  courtName: string;
  startHour: number;
  endHour: number;
  totalPrice: number;
  accessPin: string | null;
}

export interface BookingModalProps {
  mode: 'create' | 'edit';
  /** Called when user clicks the save/create button. */
  onSave: (payload: {
    bookingType: BType;
    bookerId: string;
    status?: 'pending' | 'confirmed' | 'cancelled';
    trainerId: string | null;
    playerIds: string[];
    notes: string;
    eventName: string | null;
    eventMaxParticipants: number | null;
    eventAttendeeIds: string[];
    repeatWeeks?: number; // contract only, create mode
  }) => Promise<void> | void;
  onCancel: () => void;
  onDelete?: () => Promise<void> | void;

  saving?: boolean;

  // Summary row (edit mode only) — what's already on the booking
  summary?: BookingSummary;

  // Pool data
  users: PickerUser[];
  groups: PickerGroup[];
  trainers: TrainerOpt[];

  // Initial values
  initialType?: BType;
  initialStatus?: 'pending' | 'confirmed' | 'cancelled';
  initialBookerId?: string;
  initialTrainerId?: string | null;
  initialPlayerIds?: string[];
  initialAttendeeIds?: string[];
  initialNotes?: string;
  initialEventName?: string;
  initialEventMax?: string;
  initialRepeatWeeks?: number;

  /** Edit-mode only: the booking id, used by AttendanceBoard for RSVP/check-in. */
  bookingId?: string;
  /** Edit-mode only: who is recorded as having checked players in. */
  checkedInBy?: string;
}

export function BookingModal(props: BookingModalProps) {
  const {
    mode, onSave, onCancel, onDelete, saving = false, summary,
    users, groups, trainers,
    initialType = 'regular',
    initialStatus = 'confirmed',
    initialBookerId = '',
    initialTrainerId = '',
    initialPlayerIds = [],
    initialAttendeeIds = [],
    initialNotes = '',
    initialEventName = '',
    initialEventMax = '8',
    initialRepeatWeeks = 4,
    bookingId,
    checkedInBy,
  } = props;

  const [type, setType] = useState<BType>(initialType);
  const [status, setStatus] = useState(initialStatus);
  const [bookerId, setBookerId] = useState(initialBookerId);
  const [trainerId, setTrainerId] = useState(initialTrainerId ?? '');
  const [playerIds, setPlayerIds] = useState<string[]>(initialPlayerIds);
  const [attendeeIds, setAttendeeIds] = useState<string[]>(initialAttendeeIds);
  const [notes, setNotes] = useState(initialNotes);
  const [eventName, setEventName] = useState(initialEventName);
  const [eventMax, setEventMax] = useState(initialEventMax);
  const [repeatWeeks, setRepeatWeeks] = useState(String(initialRepeatWeeks));

  useEffect(() => { if (mode === 'edit') setType(initialType); }, [mode, initialType]);

  const config = TYPE_CONFIG[type];

  const save = () => onSave({
    bookingType: type,
    bookerId,
    status: mode === 'edit' ? status : undefined,
    trainerId: type === 'training' ? (trainerId || null) : null,
    playerIds: type === 'training' ? playerIds : [],
    notes,
    eventName: type === 'event' ? eventName : null,
    eventMaxParticipants: type === 'event' ? (Number(eventMax) || null) : null,
    eventAttendeeIds: type === 'event' ? attendeeIds : [],
    repeatWeeks: mode === 'create' && type === 'contract' ? (Number(repeatWeeks) || 4) : undefined,
  });

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 32, height: 32, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: config.bg, color: config.text, fontWeight: 700, fontSize: 14,
            }}>{config.icon}</span>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>
              {mode === 'create' ? `New ${config.label}` : `Edit ${config.label}`}
            </h2>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 8px' }}>&times;</button>
        </div>

        {summary && (
          <div style={{
            background: 'var(--bg-body)', borderRadius: 10, padding: 14, marginBottom: 20,
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
          }}>
            <Info l="Court" v={summary.courtName} />
            <Info l="Time" v={`${summary.startHour}:00 — ${summary.endHour}:00`} />
            <Info l="Price" v={`${summary.totalPrice.toFixed(0)} SEK`} />
            <Info l="PIN" v={summary.accessPin ?? '—'} mono />
          </div>
        )}

        {/* Type tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {(['regular', 'training', 'contract', 'event'] as BType[]).map(t => {
            const tc = TYPE_CONFIG[t]; const on = type === t;
            return (
              <button
                key={t}
                onClick={() => setType(t)}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  border: `1.5px solid ${on ? tc.border : 'var(--border)'}`,
                  background: on ? tc.bg : 'transparent',
                  color: on ? tc.text : 'var(--text-dim)',
                }}
              >
                {tc.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          {mode === 'edit' && (
            <Field label="Status">
              <select value={status} onChange={e => setStatus(e.target.value as any)} style={inp}>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
          )}
          {type !== 'event' && (
            <Field label="Booker">
              <select value={bookerId} onChange={e => setBookerId(e.target.value)} style={inp}>
                <option value="">— Admin —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </Field>
          )}
          {type === 'training' && (
            <Field label="Trainer">
              <select value={trainerId} onChange={e => setTrainerId(e.target.value)} style={inp}>
                <option value="">Select trainer…</option>
                {trainers.map(t => <option key={t.id} value={t.id}>{t.full_name} ({t.hourly_rate} SEK/h)</option>)}
              </select>
            </Field>
          )}
          {type === 'contract' && mode === 'create' && (
            <Field label="Repeat for (weeks)">
              <input type="number" min={1} max={52} value={repeatWeeks} onChange={e => setRepeatWeeks(e.target.value)} style={inp} />
            </Field>
          )}
          {type === 'event' && (
            <>
              <Field label="Event name">
                <input value={eventName} onChange={e => setEventName(e.target.value)} style={inp} placeholder="e.g. Friday Social Padel" />
              </Field>
              <Field label="Max participants">
                <input type="number" min={2} max={64} value={eventMax} onChange={e => setEventMax(e.target.value)} style={inp} />
              </Field>
            </>
          )}
        </div>

        {/* Training roster — picker for create, AttendanceBoard for edit */}
        {type === 'training' && mode === 'create' && (
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Training roster</label>
            <PlayerPicker
              users={users}
              groups={groups}
              selected={playerIds}
              onChange={setPlayerIds}
              accent={{ border: TYPE_CONFIG.training.border, bg: TYPE_CONFIG.training.bg, text: TYPE_CONFIG.training.text }}
            />
          </div>
        )}
        {type === 'training' && mode === 'edit' && bookingId && (
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Roster &amp; attendance</label>
            <AttendanceBoard
              bookingId={bookingId}
              candidates={users.map(u => ({ id: u.id, full_name: u.full_name }))}
              checkedInBy={checkedInBy}
            />
          </div>
        )}

        {/* Event attendees — AttendanceBoard with check-in disabled (events less likely to need post-session attendance) */}
        {type === 'event' && mode === 'edit' && bookingId && (
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Attendees{eventMax ? ` (cap ${eventMax})` : ''}</label>
            <AttendanceBoard
              bookingId={bookingId}
              candidates={users.map(u => ({ id: u.id, full_name: u.full_name }))}
              showCheckIn={false}
              checkedInBy={checkedInBy}
            />
          </div>
        )}

        <Field label="Notes">
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Optional…" />
        </Field>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving} style={{ flex: 1 }}>
            {saving ? 'Saving…' : mode === 'create' ? `Create ${config.label}` : 'Save changes'}
          </button>
          <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
          {mode === 'edit' && onDelete && (
            <button
              onClick={onDelete}
              disabled={saving}
              style={{
                background: 'var(--red-bg)', color: 'var(--red)',
                border: '1px solid var(--red-border)', borderRadius: 10,
                padding: '10px 18px', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit',
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label style={lbl}>{label}</label>{children}</div>;
}

function Info({ l, v, mono }: { l: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 2 }}>{l}</div>
      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: mono ? 'monospace' : 'inherit' }}>{v}</div>
    </div>
  );
}

const lbl: CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.7,
};
const inp: CSSProperties = {
  padding: '9px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)',
  borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', width: '100%',
};
const overlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  animation: 'fadeIn 0.2s ease',
};
const modalStyle: CSSProperties = {
  background: 'var(--bg-card)', borderRadius: 18, padding: 32, width: 620,
  maxHeight: '90vh', overflow: 'auto',
  boxShadow: '0 20px 60px rgba(0,0,0,0.12)', border: '1px solid var(--border)',
  animation: 'fadeUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both',
};
