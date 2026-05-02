'use client';
/**
 * FilterBar — horizontal strip of filter controls used on the unified Schedule page.
 *
 * All filters are optional; pass only the props for the filters you want to show.
 * Callers own state (single source of truth) and handle the filter logic themselves.
 */
import { CSSProperties, ReactNode } from 'react';

export interface FilterOption { id: string; label: string; sublabel?: string; }

export interface FilterBarProps {
  clubs?: FilterOption[];
  selectedClubId?: string;
  onClubChange?: (id: string) => void;

  courts?: FilterOption[];
  selectedCourtId?: string | 'all';
  onCourtChange?: (id: string | 'all') => void;

  trainers?: FilterOption[];
  selectedTrainerId?: string | 'all';
  onTrainerChange?: (id: string | 'all') => void;

  players?: FilterOption[];
  selectedPlayerId?: string | 'all';
  onPlayerChange?: (id: string | 'all') => void;

  bookingType?: 'all' | 'regular' | 'training' | 'contract' | 'event';
  onBookingTypeChange?: (t: 'all' | 'regular' | 'training' | 'contract' | 'event') => void;

  /** Anything extra the caller wants to append (e.g. date nav, create button). */
  right?: ReactNode;
}

const TYPE_LABELS: Record<NonNullable<FilterBarProps['bookingType']>, string> = {
  all: 'Alla typer',
  regular: 'Bokning',
  training: 'Träning',
  contract: 'Avtal',
  event: 'Evenemang',
};

export function FilterBar({
  clubs, selectedClubId, onClubChange,
  courts, selectedCourtId, onCourtChange,
  trainers, selectedTrainerId, onTrainerChange,
  players, selectedPlayerId, onPlayerChange,
  bookingType, onBookingTypeChange,
  right,
}: FilterBarProps) {
  return (
    <div style={barStyle}>
      {clubs && onClubChange && (
        <Field label="Klubb">
          <select value={selectedClubId} onChange={e => onClubChange(e.target.value)} style={inpStyle}>
            {clubs.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
      )}

      {courts && onCourtChange && (
        <Field label="Bana">
          <select value={selectedCourtId ?? 'all'} onChange={e => onCourtChange(e.target.value as any)} style={inpStyle}>
            <option value="all">Alla banor</option>
            {courts.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
      )}

      {trainers && onTrainerChange && (
        <Field label="Tränare">
          <select value={selectedTrainerId ?? 'all'} onChange={e => onTrainerChange(e.target.value as any)} style={inpStyle}>
            <option value="all">Alla tränare</option>
            {trainers.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
      )}

      {players && onPlayerChange && (
        <Field label="Spelare">
          <select value={selectedPlayerId ?? 'all'} onChange={e => onPlayerChange(e.target.value as any)} style={inpStyle}>
            <option value="all">Alla spelare</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
      )}

      {bookingType !== undefined && onBookingTypeChange && (
        <Field label="Typ">
          <select value={bookingType} onChange={e => onBookingTypeChange(e.target.value as any)} style={inpStyle}>
            {(['all', 'regular', 'training', 'contract', 'event'] as const).map(t => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </Field>
      )}

      {right !== undefined && (
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'flex-end' }}>{right}</div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label style={lblStyle}>{label}</label>
      {children}
    </div>
  );
}

const barStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  marginBottom: 20,
  alignItems: 'flex-end',
  flexWrap: 'wrap',
};
const inpStyle: CSSProperties = {
  padding: '9px 12px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
  fontSize: 13,
  fontFamily: 'inherit',
  minWidth: 160,
};
const lblStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: 5,
  textTransform: 'uppercase',
  letterSpacing: 0.7,
};
