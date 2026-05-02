'use client';
/**
 * AttendanceBoard — RSVP + check-in management for one booking.
 *
 * Four columns: Going / Invited / Waitlist / Declined. Each player chip has a
 * small move menu (click → pick new status). After the session, trainers can
 * mark Present / No-show on going players from a separate row.
 *
 * Backed by /api/bookings/:id/attendance/* — see apps/api/src/routes/attendance.ts.
 * Waitlist auto-promotion happens server-side; the result is reflected on
 * reload.
 *
 * Lives inside BookingModal in edit mode for training + event types.
 */
import { useEffect, useState, CSSProperties } from 'react';

const API = '/api';

export type RsvpStatus = 'invited' | 'going' | 'declined' | 'waitlist' | 'present' | 'no_show';

export interface AttendanceRow {
  booking_id: string;
  user_id: string;
  status: RsvpStatus;
  responded_at: string | null;
  checked_in_at: string | null;
  checked_in_by: string | null;
  waitlist_position: number | null;
  full_name: string;
  email: string | null;
}

export interface AttendanceBoardProps {
  bookingId: string;
  /** Pool of users that can be added to this booking (typically the assigned roster). */
  candidates?: { id: string; full_name: string }[];
  /** Render present/no-show check-in row (default: true). */
  showCheckIn?: boolean;
  /** Optional: who the current admin user is — recorded as `checked_in_by` on present/no_show. */
  checkedInBy?: string;
  /** Notify the parent of any change so it can re-fetch the booking. */
  onChange?: () => void;
}

interface ColumnDef {
  key: RsvpStatus;
  label: string;
  hint: string;
  color: string;
  bg: string;
  border: string;
}

const COLUMNS: ColumnDef[] = [
  { key: 'going',    label: 'Kommer', hint: 'Bekräftat', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  { key: 'invited',  label: 'Inbjudna', hint: 'Inget svar', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  { key: 'waitlist', label: 'Reservlista', hint: 'Väntar på plats', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { key: 'declined', label: 'Tackat nej', hint: 'Avböjt', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
];

const MOVABLE: RsvpStatus[] = ['going', 'invited', 'waitlist', 'declined'];

export function AttendanceBoard({ bookingId, candidates = [], showCheckIn = true, checkedInBy, onChange }: AttendanceBoardProps) {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [moving, setMoving] = useState<string | null>(null); // user id with menu open
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`${API}/bookings/${bookingId}/attendance`).then(r => r.json());
      if (!r.success) throw new Error(r.error ?? 'Kunde inte ladda närvaro');
      setRows(r.data ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [bookingId]);

  const setStatus = async (userId: string, status: RsvpStatus) => {
    setBusy(true); setMoving(null);
    try {
      const body: any = { status };
      if ((status === 'present' || status === 'no_show') && checkedInBy) body.checkedInBy = checkedInBy;
      await fetch(`${API}/bookings/${bookingId}/attendance/${userId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      await reload();
      onChange?.();
    } finally {
      setBusy(false);
    }
  };

  const addCandidate = async (userId: string) => {
    await setStatus(userId, 'invited');
  };

  // ─── Bucket rows by column ────────────────────────────────────
  const byStatus: Record<RsvpStatus, AttendanceRow[]> = {
    going: [], invited: [], waitlist: [], declined: [], present: [], no_show: [],
  };
  for (const r of rows) byStatus[r.status].push(r);

  const knownIds = new Set(rows.map(r => r.user_id));
  const toAdd = candidates.filter(c => !knownIds.has(c.id));

  const goingOrCheckedIn = [...byStatus.going, ...byStatus.present, ...byStatus.no_show];

  if (loading) return <div className="loading" style={{ padding: 12 }}>Laddar närvaro…</div>;
  if (error) return <div style={errBox}>Fel: {error} <button onClick={reload} className="btn btn-outline" style={{ marginLeft: 8 }}>Försök igen</button></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 4-column board */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {COLUMNS.map(col => {
          const colRows = byStatus[col.key];
          return (
            <div key={col.key} style={{
              border: `1px solid ${col.border}`,
              background: col.bg,
              borderRadius: 12,
              padding: 12,
              minHeight: 140,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: col.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {col.label} <span style={{ marginLeft: 4 }}>{colRows.length}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{col.hint}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {colRows.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>Tomt</div>
                )}
                {colRows
                  .sort((a, b) => (a.waitlist_position ?? 0) - (b.waitlist_position ?? 0) || a.full_name.localeCompare(b.full_name))
                  .map(r => (
                    <PlayerChip
                      key={r.user_id}
                      row={r}
                      column={col}
                      onMove={(s) => setStatus(r.user_id, s)}
                      menuOpen={moving === r.user_id}
                      onToggleMenu={() => setMoving(moving === r.user_id ? null : r.user_id)}
                      disabled={busy}
                    />
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Check-in row (post-session) */}
      {showCheckIn && goingOrCheckedIn.length > 0 && (
        <div style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Incheckning
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {goingOrCheckedIn.map(r => (
              <div key={r.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg-body)', borderRadius: 8 }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{r.full_name}</span>
                {r.checked_in_at && (
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', marginRight: 6 }}>
                    {r.status === 'present' ? '✓ ' : '✗ '}{new Date(r.checked_in_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <button
                  onClick={() => setStatus(r.user_id, 'present')}
                  disabled={busy || r.status === 'present'}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
                    border: `1px solid ${r.status === 'present' ? '#a7f3d0' : 'var(--border)'}`,
                    background: r.status === 'present' ? '#ecfdf5' : '#fff',
                    color: r.status === 'present' ? '#059669' : 'var(--text-muted)',
                    fontFamily: 'inherit',
                  }}
                >
                  Närvarande
                </button>
                <button
                  onClick={() => setStatus(r.user_id, 'no_show')}
                  disabled={busy || r.status === 'no_show'}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
                    border: `1px solid ${r.status === 'no_show' ? '#fecaca' : 'var(--border)'}`,
                    background: r.status === 'no_show' ? '#fef2f2' : '#fff',
                    color: r.status === 'no_show' ? '#dc2626' : 'var(--text-muted)',
                    fontFamily: 'inherit',
                  }}
                >
                  Uteblev
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add from roster */}
      {toAdd.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Lägg till från grupp
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {toAdd.map(c => (
              <button
                key={c.id}
                onClick={() => addCandidate(c.id)}
                disabled={busy}
                style={{
                  padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
                  border: '1px dashed var(--border)', background: 'var(--bg-body)', color: 'var(--text-muted)',
                  fontFamily: 'inherit',
                }}
              >
                + {c.full_name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerChip({ row, column, onMove, menuOpen, onToggleMenu, disabled }: {
  row: AttendanceRow;
  column: ColumnDef;
  onMove: (s: RsvpStatus) => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  disabled: boolean;
}) {
  const otherStatuses = MOVABLE.filter(s => s !== column.key);
  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: '#fff', border: `1px solid ${column.border}`,
        borderRadius: 8, padding: '6px 4px 6px 10px',
      }}>
        {row.status === 'waitlist' && row.waitlist_position != null && (
          <span style={{
            width: 18, height: 18, borderRadius: 9, background: column.color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700,
          }}>{row.waitlist_position}</span>
        )}
        <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{row.full_name}</span>
        <button
          onClick={onToggleMenu}
          disabled={disabled}
          style={{
            padding: '2px 6px', fontSize: 14, lineHeight: 1, cursor: disabled ? 'wait' : 'pointer',
            border: 'none', background: 'transparent', color: 'var(--text-muted)',
            borderRadius: 4, fontFamily: 'inherit',
          }}
          title="Flytta…"
        >
          ⋯
        </button>
      </div>
      {menuOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 5,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.10)',
          padding: 4, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 110,
        }}>
          {otherStatuses.map(s => {
            const def = COLUMNS.find(c => c.key === s)!;
            return (
              <button
                key={s}
                onClick={() => onMove(s)}
                style={{
                  padding: '6px 10px', fontSize: 11, fontWeight: 600,
                  border: 'none', background: 'transparent', textAlign: 'left',
                  cursor: 'pointer', borderRadius: 6, color: def.color, fontFamily: 'inherit',
                }}
              >
                Flytta till {def.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const errBox: CSSProperties = {
  padding: 12, borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca',
  color: '#b91c1c', fontSize: 13,
};
