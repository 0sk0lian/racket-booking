'use client';
/**
 * ScheduleGrid — the shared courts×time grid used by Day, Week, and Templates views.
 *
 * Callers describe:
 *   - courts: the rows (court_id, name, sport_type, base_rate)
 *   - days:   the day "columns" (each has an opaque string key and a label)
 *   - hours:  time range (default 7..21)
 *   - items:  positioned blocks {day_key, court_id, start_hour, end_hour, payload}
 *
 * The grid is day-agnostic: in Day view, days=[{key:'2026-04-15', label:'Tuesday'}]; in
 * Week view, days is a 7-entry array of real dates; in Templates view, days is
 * Mon..Sun using synthetic keys like 'T1'..'T0' that callers interpret themselves.
 *
 * Drag-select state is lifted — caller owns `selected: Set<CellKey>`. CellKey format:
 *   `${courtId}__${dayKey}__${hour}`
 * so one Set can span multiple days (important for Week view drag-select).
 */
import { useEffect, useState, useRef, useCallback, CSSProperties } from 'react';

export type CellKey = `${string}__${string}__${number}`;

export function cellKey(courtId: string, dayKey: string, hour: number): CellKey {
  return `${courtId}__${dayKey}__${hour}` as CellKey;
}

export function parseCellKey(k: CellKey): { courtId: string; dayKey: string; hour: number } {
  const parts = k.split('__');
  const hour = Number(parts.pop());
  const dayKey = parts.pop()!;
  const courtId = parts.join('__'); // rejoin in case court_id had double-underscore (unlikely but safe)
  return { courtId, dayKey, hour };
}

export interface GridCourt {
  id: string;
  name: string;
  sport_type?: string;
  base_rate?: number;
}

export interface GridDay {
  key: string;       // opaque to the grid — caller's responsibility
  label: string;     // top label, e.g. "Monday" or "Apr 15"
  sublabel?: string; // optional small line under label
}

export interface GridItem<P = unknown> {
  id: string;
  court_id: string;
  day_key: string;
  start_hour: number;
  end_hour: number;
  /** Display classification — callers pick the palette */
  variant: 'regular' | 'training' | 'contract' | 'event' | 'template';
  title: string;
  subtitle?: string;
  /** Optional extra line (e.g. "3/8 going") */
  caption?: string;
  /** Ghost rendering for projected/planned items in Week view overlays */
  ghost?: boolean;
  payload?: P;
}

export interface ScheduleGridProps<P = unknown> {
  courts: GridCourt[];
  days: GridDay[];
  items: GridItem<P>[];
  hours?: number[];
  selected: Set<CellKey>;
  onSelectChange: (s: Set<CellKey>) => void;
  onItemClick?: (item: GridItem<P>) => void;
  /** Optional per-cell empty-click handler (for single-click-creates-template flow). */
  onEmptyClick?: (courtId: string, dayKey: string, hour: number) => void;
  /** Callback when a booking item is drag-moved to a new cell. */
  onItemMove?: (item: GridItem<P>, newCourtId: string, newDayKey: string, newStartHour: number) => void;
  /** Disable drag-select entirely (e.g. in read-only views). */
  disableSelection?: boolean;
  /** Compact height for dense views. Defaults to 56px per hour. */
  rowHeight?: number;
}

const DEFAULT_HOURS = Array.from({ length: 15 }, (_, i) => i + 7);

const VARIANT: Record<GridItem['variant'], { bg: string; border: string; text: string }> = {
  regular:  { bg: '#ecfdf5', border: '#10b981', text: '#059669' },
  training: { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8' },
  contract: { bg: '#f5f3ff', border: '#8b5cf6', text: '#6d28d9' },
  event:    { bg: '#fffbeb', border: '#f59e0b', text: '#b45309' },
  template: { bg: '#f0fdf4', border: '#22c55e', text: '#15803d' },
};

export function ScheduleGrid<P = unknown>({
  courts, days, items, hours = DEFAULT_HOURS,
  selected, onSelectChange, onItemClick, onEmptyClick, onItemMove,
  disableSelection = false, rowHeight = 56,
}: ScheduleGridProps<P>) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'select' | 'deselect'>('select');

  // ─── Drag-move state ────────────────────────────────────────
  const [draggingItem, setDraggingItem] = useState<GridItem<P> | null>(null);
  const [dragTarget, setDragTarget] = useState<{ courtId: string; dayKey: string; hour: number } | null>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragThresholdMet = useRef(false);

  // Check if a target position is valid for dropping (no overlapping items)
  const isDropValid = useCallback((item: GridItem<P>, courtId: string, dayKey: string, startHour: number): boolean => {
    const duration = item.end_hour - item.start_hour;
    const endHour = startHour + duration;
    if (endHour > hours[hours.length - 1] + 1) return false; // exceeds grid
    for (let h = startHour; h < endHour; h++) {
      const existing = items.find(i =>
        i.id !== item.id &&
        i.court_id === courtId &&
        i.day_key === dayKey &&
        h >= i.start_hour &&
        h < i.end_hour,
      );
      if (existing) return false;
    }
    return true;
  }, [items, hours]);

  // Handle item mousedown — start potential drag-move
  const onItemMouseDown = useCallback((e: React.MouseEvent, item: GridItem<P>) => {
    if (!onItemMove) return;
    e.preventDefault();
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragThresholdMet.current = false;

    const handleMouseMove = (me: MouseEvent) => {
      if (!dragThresholdMet.current) {
        const dx = me.clientX - dragStartPos.current!.x;
        const dy = me.clientY - dragStartPos.current!.y;
        if (Math.abs(dx) + Math.abs(dy) < 8) return; // threshold not met yet
        dragThresholdMet.current = true;
        setDraggingItem(item);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      dragStartPos.current = null;

      if (!dragThresholdMet.current) {
        // It was a click, not a drag
        onItemClick?.(item);
      }
      // drag-move completion is handled by onCellMouseUp below
      // If threshold was met but no valid target, cancel
      setDraggingItem(null);
      setDragTarget(null);
      dragThresholdMet.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [onItemMove, onItemClick]);

  // When hovering over a cell while dragging an item
  const onCellDragEnter = useCallback((courtId: string, dayKey: string, hour: number) => {
    if (!draggingItem) return;
    if (isDropValid(draggingItem, courtId, dayKey, hour)) {
      setDragTarget({ courtId, dayKey, hour });
    } else {
      setDragTarget(null);
    }
  }, [draggingItem, isDropValid]);

  // When releasing on a cell while dragging
  const onCellMouseUp = useCallback((courtId: string, dayKey: string, hour: number) => {
    if (!draggingItem || !onItemMove) return;
    if (isDropValid(draggingItem, courtId, dayKey, hour)) {
      // Don't move if same position
      if (draggingItem.court_id !== courtId || draggingItem.day_key !== dayKey || draggingItem.start_hour !== hour) {
        onItemMove(draggingItem, courtId, dayKey, hour);
      }
    }
    setDraggingItem(null);
    setDragTarget(null);
  }, [draggingItem, onItemMove, isDropValid]);

  useEffect(() => {
    const up = () => setIsDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // For any (court, day, hour) return the item covering that cell, if any
  const findItem = (courtId: string, dayKey: string, hour: number): GridItem<P> | undefined =>
    items.find(i =>
      i.court_id === courtId &&
      i.day_key === dayKey &&
      hour >= i.start_hour &&
      hour < i.end_hour,
    );

  const onDown = (k: CellKey, courtId: string, dayKey: string, h: number) => {
    if (disableSelection) return;
    if (findItem(courtId, dayKey, h)) return;
    setIsDragging(true);
    const s = new Set(selected);
    if (s.has(k)) { s.delete(k); setDragMode('deselect'); }
    else { s.add(k); setDragMode('select'); }
    onSelectChange(s);
  };

  const onEnter = (k: CellKey, courtId: string, dayKey: string, h: number) => {
    if (disableSelection || !isDragging) return;
    if (findItem(courtId, dayKey, h)) return;
    const s = new Set(selected);
    if (dragMode === 'select') s.add(k); else s.delete(k);
    onSelectChange(s);
  };

  // We render one "mega row" per court, composed of day-partitions side by side
  // so drag-select naturally extends across days in Week view.
  const totalDayCols = days.length;
  const cellsPerRow = totalDayCols * hours.length;

  return (
    <div style={wrapStyle}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `180px repeat(${cellsPerRow}, 1fr)`,
        minWidth: cellsPerRow * 48 + 180,
        userSelect: 'none',
      }}>
        {/* Header row: court column + for each day, an hour sub-row */}
        <div style={cornerStyle} />
        {days.map(day => (
          <div key={day.key} style={{
            gridColumn: `span ${hours.length}`,
            padding: '6px 4px',
            textAlign: 'center',
            borderBottom: '1px solid var(--border)',
            borderLeft: days.length > 1 ? '1px solid var(--border)' : undefined,
            background: 'var(--bg-body)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.3, textTransform: 'capitalize' }}>{day.label}</div>
            {day.sublabel && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>{day.sublabel}</div>}
          </div>
        ))}

        {/* Sub-header: hour labels under each day */}
        <div style={hdrStyle} />
        {days.flatMap(day => hours.map(h => (
          <div key={`${day.key}__${h}`} style={{ ...hdrStyle, fontSize: 10 }}>{String(h).padStart(2, '0')}</div>
        )))}

        {/* Court rows */}
        {courts.map(court => (
          <div key={court.id} style={{ display: 'contents' }}>
            <div style={{ ...courtLblStyle, minHeight: rowHeight }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{court.name}</div>
              {(court.sport_type || court.base_rate !== undefined) && (
                <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                  {court.sport_type}{court.base_rate !== undefined && ` · ${court.base_rate} SEK/h`}
                </div>
              )}
            </div>

            {days.flatMap(day => hours.map(h => {
              const k = cellKey(court.id, day.key, h);
              const item = findItem(court.id, day.key, h);
              const isSel = selected.has(k);

              // Check if this cell is a drag-move ghost target
              const isGhostCell = draggingItem && dragTarget &&
                dragTarget.courtId === court.id &&
                dragTarget.dayKey === day.key &&
                h >= dragTarget.hour &&
                h < dragTarget.hour + (draggingItem.end_hour - draggingItem.start_hour);
              const isGhostStart = isGhostCell && h === dragTarget!.hour;

              if (item) {
                const v = VARIANT[item.variant];
                const isStart = item.start_hour === h;
                const isLast = h + 1 >= item.end_hour;
                const isDragSource = draggingItem?.id === item.id;
                const opacity = item.ghost ? 0.45 : isDragSource ? 0.35 : 1;
                return (
                  <div
                    key={k}
                    onMouseDown={onItemMove ? (e) => onItemMouseDown(e, item) : undefined}
                    onClick={onItemMove ? undefined : () => onItemClick?.(item)}
                    onMouseEnter={() => onCellDragEnter(court.id, day.key, h)}
                    onMouseUp={() => onCellMouseUp(court.id, day.key, h)}
                    style={{
                      ...cellStyle,
                      height: rowHeight,
                      background: v.bg,
                      opacity,
                      cursor: onItemMove ? 'grab' : onItemClick ? 'pointer' : 'default',
                      // Item-start indicator drawn as inset shadow so it doesn't
                      // displace the cell's content area (borderLeft would).
                      boxShadow: isStart ? `inset 3px 0 0 ${v.border}` : undefined,
                      // Suppress the right border between two cells of the same
                      // booking so multi-hour items render as one continuous block
                      // instead of being chopped by a dividing gray line.
                      borderRight: isLast ? cellStyle.borderRight : 'none',
                      borderStyle: item.ghost ? 'dashed' : 'solid',
                    }}
                  >
                    {isStart && (
                      <div style={{ overflow: 'hidden', lineHeight: 1.3 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: v.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div style={{ fontSize: 9.5, fontWeight: 600, color: v.text, opacity: 0.65, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.subtitle}
                          </div>
                        )}
                        {item.caption && rowHeight > 38 && (
                          <div style={{ fontSize: 9, color: v.text, opacity: 0.55, marginTop: 1 }}>{item.caption}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              // Render ghost overlay for drag-move target
              if (isGhostCell && draggingItem) {
                const gv = VARIANT[draggingItem.variant];
                const duration = draggingItem.end_hour - draggingItem.start_hour;
                const isGhostLast = h + 1 >= dragTarget!.hour + duration;
                return (
                  <div
                    key={k}
                    onMouseEnter={() => onCellDragEnter(court.id, day.key, h)}
                    onMouseUp={() => onCellMouseUp(court.id, day.key, h)}
                    style={{
                      ...cellStyle,
                      height: rowHeight,
                      background: gv.bg,
                      opacity: 0.55,
                      borderStyle: 'dashed',
                      borderColor: gv.border,
                      boxShadow: isGhostStart ? `inset 3px 0 0 ${gv.border}` : undefined,
                      borderRight: isGhostLast ? cellStyle.borderRight : 'none',
                      cursor: 'grabbing',
                    }}
                  >
                    {isGhostStart && (
                      <div style={{ overflow: 'hidden', lineHeight: 1.3 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: gv.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {draggingItem.title}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={k}
                  onMouseDown={() => onDown(k, court.id, day.key, h)}
                  onMouseEnter={() => { onEnter(k, court.id, day.key, h); onCellDragEnter(court.id, day.key, h); }}
                  onMouseUp={() => onCellMouseUp(court.id, day.key, h)}
                  onClick={() => !isDragging && onEmptyClick?.(court.id, day.key, h)}
                  style={{
                    ...cellStyle,
                    height: rowHeight,
                    cursor: draggingItem ? 'grabbing' : disableSelection ? (onEmptyClick ? 'pointer' : 'default') : 'crosshair',
                    background: isSel ? '#eef2ff' : '#fff',
                    boxShadow: isSel ? 'inset 0 0 0 1px #a5b4fc' : undefined,
                  }}
                />
              );
            }))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helper: extract contiguous slots from a drag-selection ──────
// Groups selected cells into (courtId, dayKey, startHour, endHour) ranges so
// callers can feed them to a booking creation endpoint.
export interface SelectedSlot {
  courtId: string;
  dayKey: string;
  startHour: number;
  endHour: number;
  hours: number;
}
export function selectionToSlots(selected: Set<CellKey>): SelectedSlot[] {
  const bucket: Record<string, number[]> = {};
  for (const k of selected) {
    const { courtId, dayKey, hour } = parseCellKey(k);
    const bk = `${courtId}__${dayKey}`;
    (bucket[bk] ??= []).push(hour);
  }
  const slots: SelectedSlot[] = [];
  for (const [bk, hrs] of Object.entries(bucket)) {
    const [courtId, dayKey] = bk.split('__');
    hrs.sort((a, b) => a - b);
    let s = hrs[0], e = hrs[0];
    for (let i = 1; i <= hrs.length; i++) {
      if (i < hrs.length && hrs[i] === e + 1) { e = hrs[i]; continue; }
      slots.push({ courtId, dayKey, startHour: s, endHour: e + 1, hours: e - s + 1 });
      if (i < hrs.length) { s = hrs[i]; e = hrs[i]; }
    }
  }
  return slots;
}

// ─── Styles ─────────────────────────────────────────────────────

const wrapStyle: CSSProperties = {
  overflowX: 'auto',
  borderRadius: 14,
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  boxShadow: 'var(--shadow-sm)',
};

const hdrStyle: CSSProperties = {
  padding: '8px 4px',
  fontSize: 10.5,
  fontWeight: 700,
  color: 'var(--text-dim)',
  textAlign: 'center',
  letterSpacing: 0.5,
  borderRight: '1px solid var(--border)',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg-body)',
  boxSizing: 'border-box',
};

// Plain corner cell sitting in row 1 col 1. Row 2 col 1 has its own
// placeholder hdrStyle div in the JSX — letting the source order flow
// naturally instead of relying on rowspan keeps CSS Grid auto-flow honest
// and avoids the implicit-row bug where the trailing hour label ('21')
// got pushed off the end of the header row.
const cornerStyle: CSSProperties = {
  ...hdrStyle,
  background: 'var(--bg-body)',
};

const courtLblStyle: CSSProperties = {
  padding: '10px 14px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  background: 'var(--bg-card)',
  position: 'sticky',
  left: 0,
  zIndex: 1,
  borderRight: '1px solid var(--border)',
  borderBottom: '1px solid var(--border)',
};

// Each cell carries only right + bottom borders so adjacent cells share one
// stroke — uniform column widths, no double-borders. The wrapper (wrapStyle)
// supplies the outer top + left edges. Border colour is intentionally lighter
// than var(--border) (#e2e8f0) so it stays readable as a divider on white
// AND doesn't visually overpower coloured booking cells. Booking cells suppress
// their right border entirely when followed by a continuation cell of the same
// item (see render logic above).
const cellStyle: CSSProperties = {
  borderRight: '1px solid #f1f5f9',
  borderBottom: '1px solid #f1f5f9',
  padding: 5,
  boxSizing: 'border-box',
  transition: 'background 0.15s ease',
};
