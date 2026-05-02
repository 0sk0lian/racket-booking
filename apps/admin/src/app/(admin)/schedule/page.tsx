'use client';
/**
 * Unified Schedule — Day / Week / Templates in one page.
 *
 * Was two separate pages (schedule + training-planner). Now one page with:
 *   - a view toggle (Day / Week / Templates),
 *   - one shared grid (ScheduleGrid),
 *   - one shared filter bar (club + court + trainer + player + type),
 *   - one shared creation / edit modal (BookingModal),
 *   - one shared player picker (PlayerPicker, inside the modal).
 *
 * /training-planner now redirects here with ?view=templates.
 */
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  ScheduleGrid, GridDay, GridItem, CellKey, selectionToSlots, parseCellKey,
} from '../../../components/ScheduleGrid';
import { FilterBar, FilterOption } from '../../../components/FilterBar';
import { BookingModal, BType } from '../../../components/BookingModal';
import { ApplyPreviewModal } from '../../../components/ApplyPreviewModal';

const API = '/api';

// ─── API-shape types ──────────────────────────────────────────────

interface Booking {
  id: string; startHour: number; endHour: number; status: string; bookingType: BType;
  bookerName: string; bookerId: string; totalPrice: number; accessPin: string;
  trainerId: string | null; trainerName: string | null;
  playerIds: string[]; playerNames: string[];
  contractId: string | null; recurrenceDay: number | null;
  eventName: string | null; eventMaxParticipants: number | null;
  attendeeCount: number; eventAttendeeIds: string[];
  attendancePresent: number; attendanceTotal: number;
  notes: string | null; isSplitPayment: boolean;
}
interface CourtSchedule { courtId: string; courtName: string; sportType: string; baseRate: number; bookings: Booking[]; }

interface Club { id: string; name: string; }
interface User { id: string; full_name: string; role?: string; }
interface Trainer { id: string; full_name: string; sport_types: string[]; hourly_rate: number; }
interface TrainingSession {
  id: string; title: string; court_id: string; court_name: string;
  trainer_id: string; trainer_name: string; player_ids: string[];
  day_of_week: number; start_hour: number; end_hour: number;
  notes: string | null; status: string; applied_dates: string[];
}
interface Group {
  id: string; name: string; category: string;
  parent_group_id: string | null; parent_group_name: string | null;
  is_master_category: boolean;
  child_groups: { id: string; name: string; player_count: number }[];
  player_ids: string[]; players: { id: string; full_name: string }[];
}

type View = 'day' | 'week' | 'templates';
const DAY_LABELS = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];

// ─── Date helpers (local-date math) ────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addDays(s: string, n: number): string {
  const d = parseDate(s); d.setDate(d.getDate() + n); return toDateStr(d);
}
function mondayOf(s: string): string {
  const d = parseDate(s);
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow; // Sunday rolls back to previous Monday
  d.setDate(d.getDate() + offset);
  return toDateStr(d);
}

// ─── Main page ───────────────────────────────────────────────────

// Next 15 requires useSearchParams to sit inside a Suspense boundary for
// prerendering. The page is a 'use client' component anyway; wrapping the
// inner body keeps the URL-driven initial view while satisfying the build.
export default function SchedulePage() {
  return (
    <Suspense fallback={<div className="loading">Laddar…</div>}>
      <SchedulePageInner />
    </Suspense>
  );
}

function SchedulePageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialView = (params.get('view') as View) || 'day';

  const [view, setView] = useState<View>(initialView);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  // Filters (drive both views)
  const [filterCourt, setFilterCourt] = useState<string | 'all'>('all');
  const [filterTrainer, setFilterTrainer] = useState<string | 'all'>('all');
  const [filterPlayer, setFilterPlayer] = useState<string | 'all'>('all');
  const [filterType, setFilterType] = useState<'all' | BType>('all');

  // Per-view state
  const [date, setDate] = useState(() => toDateStr(new Date()));
  const [weekStart, setWeekStart] = useState(() => mondayOf(toDateStr(new Date())));

  const [dayCourts, setDayCourts] = useState<CourtSchedule[]>([]);
  const [weekCourts, setWeekCourts] = useState<Record<string, CourtSchedule[]>>({}); // date → courts
  const [templates, setTemplates] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(false);

  // Drag-select
  const [selected, setSelected] = useState<Set<CellKey>>(new Set());
  const [saving, setSaving] = useState(false);

  // Modal
  const [editing, setEditing] = useState<(Booking & { courtName: string; courtId: string }) | null>(null);
  const [creating, setCreating] = useState(false);
  const [applyPreview, setApplyPreview] = useState<{ ruleId: string; ruleTitle: string } | null>(null);

  // ─── Load clubs/users/groups once ─────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch(`${API}/clubs`).then(r => r.json()),
      fetch(`${API}/users`).then(r => r.json()),
    ]).then(([c, u]) => {
      setClubs(c.data || []);
      setUsers(u.data || []);
      if (c.data?.length) setSelectedClub(c.data[0].id);
    });
  }, []);

  // ─── When club changes, reload trainers + groups ──────────────
  useEffect(() => {
    if (!selectedClub) return;
    Promise.all([
      fetch(`${API}/admin/trainers?clubId=${selectedClub}`).then(r => r.json()),
      fetch(`${API}/features/groups?clubId=${selectedClub}`).then(r => r.json()),
    ]).then(([t, g]) => {
      setTrainers(t.data || []);
      setGroups(g.data || []);
    });
  }, [selectedClub]);

  // ─── View-specific data loaders ───────────────────────────────
  const loadDay = useCallback(async () => {
    if (!selectedClub) return; setLoading(true); setSelected(new Set());
    const r = await fetch(`${API}/admin/schedule?clubId=${selectedClub}&date=${date}`).then(r => r.json());
    setDayCourts(r.data?.courts || []); setLoading(false);
  }, [selectedClub, date]);

  const loadWeek = useCallback(async () => {
    if (!selectedClub) return; setLoading(true); setSelected(new Set());
    const dateTo = addDays(weekStart, 6);
    const r = await fetch(`${API}/admin/schedule?clubId=${selectedClub}&dateFrom=${weekStart}&dateTo=${dateTo}`).then(r => r.json());
    const days = r.data?.days || {};
    // Convert { "YYYY-MM-DD": { courts } } to { "YYYY-MM-DD": courts[] }
    const result: Record<string, any[]> = {};
    for (const [d, v] of Object.entries(days)) {
      result[d] = (v as any).courts || [];
    }
    setWeekCourts(result);
    setLoading(false);
  }, [selectedClub, weekStart]);

  const loadTemplates = useCallback(async () => {
    if (!selectedClub) return; setLoading(true); setSelected(new Set());
    const r = await fetch(`${API}/training-planner?clubId=${selectedClub}`).then(r => r.json());
    setTemplates((r.data || []).filter((t: TrainingSession) => t.status !== 'cancelled'));
    setLoading(false);
  }, [selectedClub]);

  useEffect(() => {
    if (view === 'day') loadDay();
    else if (view === 'week') loadWeek();
    else loadTemplates();
  }, [view, loadDay, loadWeek, loadTemplates]);

  // ─── Derive courts + days + items for the grid ──────────────

  // Courts list comes from whichever view is active. Apply filter.
  const allCourts = useMemo(() => {
    if (view === 'day') return dayCourts;
    if (view === 'week') {
      // Use the first non-empty day's courts list as the canonical set.
      for (const d of Object.keys(weekCourts)) {
        if (weekCourts[d].length) return weekCourts[d];
      }
      return [];
    }
    // Templates view: derive courts from the templates themselves so empty
    // courts (no templates) are still shown if they're in the club's court list.
    // We need court list from API — fallback: unique courts appearing in templates.
    const seen = new Map<string, { courtId: string; courtName: string; sportType: string; baseRate: number }>();
    for (const t of templates) {
      if (!seen.has(t.court_id)) {
        seen.set(t.court_id, { courtId: t.court_id, courtName: t.court_name, sportType: '', baseRate: 0 });
      }
    }
    return Array.from(seen.values()).map(c => ({ ...c, bookings: [] }));
  }, [view, dayCourts, weekCourts, templates]);

  const gridCourts = useMemo(() => {
    const courts = allCourts.map(c => ({
      id: c.courtId, name: c.courtName,
      sport_type: c.sportType || undefined,
      base_rate: view !== 'templates' ? c.baseRate : undefined,
    }));
    if (filterCourt !== 'all') return courts.filter(c => c.id === filterCourt);
    return courts;
  }, [allCourts, filterCourt, view]);

  const gridDays: GridDay[] = useMemo(() => {
    if (view === 'day') return [{ key: date, label: formatLongDate(date) }];
    if (view === 'week') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(weekStart, i);
        return { key: d, label: DAY_LABELS[(parseDate(d).getDay())], sublabel: d.slice(5) };
      });
    }
    // Templates view: Mon..Sun, synthetic keys T1..T0
    return [1, 2, 3, 4, 5, 6, 0].map(dow => ({ key: `T${dow}`, label: DAY_LABELS[dow] }));
  }, [view, date, weekStart]);

  const gridItems: GridItem<Booking | TrainingSession>[] = useMemo(() => {
    if (view === 'day') {
      return dayCourts.flatMap(c => c.bookings.map(b => bookingToItem(b, c.courtId, date)))
        .filter(i => passesFilters(i, filterTrainer, filterPlayer, filterType));
    }
    if (view === 'week') {
      return Object.entries(weekCourts).flatMap(([d, courts]) =>
        courts.flatMap(c => c.bookings.map(b => bookingToItem(b, c.courtId, d))),
      ).filter(i => passesFilters(i, filterTrainer, filterPlayer, filterType));
    }
    // Templates
    return templates
      .map(t => templateToItem(t))
      .filter(i => {
        if (filterTrainer !== 'all' && (i.payload as TrainingSession).trainer_id !== filterTrainer) return false;
        if (filterPlayer !== 'all' && !(i.payload as TrainingSession).player_ids.includes(filterPlayer)) return false;
        if (filterType !== 'all' && filterType !== 'training') return false; // templates are all trainings right now
        return true;
      });
  }, [view, dayCourts, weekCourts, templates, date, filterTrainer, filterPlayer, filterType]);

  // ─── Actions ─────────────────────────────────────────────────

  const onItemClick = (item: GridItem<Booking | TrainingSession>) => {
    if (view === 'templates') {
      const t = item.payload as TrainingSession;
      // Backfilled training-session templates share an id with the recurrence rule
      // so the preview modal can target it directly.
      setApplyPreview({ ruleId: t.id, ruleTitle: t.title });
      return;
    }
    const b = item.payload as Booking;
    const court = allCourts.find(c => c.courtId === item.court_id);
    if (!court) return;
    setEditing({ ...b, courtName: court.courtName, courtId: item.court_id });
  };

  const openCreate = () => {
    if (selected.size === 0) return;
    setCreating(true);
  };

  const handleCreate = async (payload: Parameters<React.ComponentProps<typeof BookingModal>['onSave']>[0]) => {
    const slots = selectionToSlots(selected);
    if (!slots.length) return; setSaving(true);

    // Week / Day: slots carry real dates in dayKey
    // Templates: dayKey is 'T<dow>' — route to training-planner POST instead
    if (view === 'templates') {
      for (const s of slots) {
        const dow = Number(s.dayKey.replace('T', ''));
        await fetch(`${API}/training-planner`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clubId: selectedClub, title: payload.eventName || 'Träningspass',
            courtId: s.courtId, trainerId: payload.trainerId,
            playerIds: payload.playerIds, dayOfWeek: dow,
            startHour: s.startHour, endHour: s.endHour, notes: payload.notes,
          }),
        });
      }
      flash(`Skapade ${slots.length} mall${slots.length === 1 ? '' : 'ar'}`);
      await loadTemplates();
    } else {
      const body: any = {
        slots: slots.map(s => ({
          courtId: s.courtId,
          startTime: `${s.dayKey}T${String(s.startHour).padStart(2, '0')}:00:00`,
          endTime: `${s.dayKey}T${String(s.endHour).padStart(2, '0')}:00:00`,
        })),
        bookingType: payload.bookingType,
        bookerId: payload.bookerId || undefined,
        notes: payload.notes,
        totalPrice: payload.totalPrice ?? undefined,
      };
      if (payload.bookingType === 'training') {
        body.trainerId = payload.trainerId;
        body.playerIds = payload.playerIds;
        body.repeatWeeks = payload.repeatWeeks ?? 1;
      }
      if (payload.bookingType === 'contract') { body.repeatWeeks = payload.repeatWeeks ?? 4; }
      if (payload.bookingType === 'event') { body.eventName = payload.eventName; body.eventMaxParticipants = payload.eventMaxParticipants; }

      const r = await fetch(`${API}/admin/bookings/bulk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }).then(r => r.json());
      flash(`Skapade ${r.data?.created ?? 0} bokning${(r.data?.created ?? 0) === 1 ? '' : 'ar'}${r.data?.failed ? ` — ${r.data.failed} konflikt(er)` : ''}`);
      view === 'day' ? await loadDay() : await loadWeek();
    }

    setSelected(new Set()); setCreating(false); setSaving(false);
  };

  const handleEditSave = async (payload: Parameters<React.ComponentProps<typeof BookingModal>['onSave']>[0]) => {
    if (!editing) return; setSaving(true);
    const body: any = {
      status: payload.status,
      bookingType: payload.bookingType,
      bookerId: payload.bookerId,
      notes: payload.notes,
      totalPrice: payload.totalPrice ?? undefined,
    };
    if (payload.bookingType === 'training') { body.trainerId = payload.trainerId; body.playerIds = payload.playerIds; }
    if (payload.bookingType === 'event') {
      body.eventName = payload.eventName;
      body.eventMaxParticipants = payload.eventMaxParticipants;
      body.eventAttendeeIds = payload.eventAttendeeIds;
    }
    await fetch(`${API}/admin/bookings/${editing.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    flash('Bokning uppdaterad'); setEditing(null); setSaving(false);
    view === 'day' ? await loadDay() : await loadWeek();
  };

  const handleEditDelete = async () => {
    if (!editing || !confirm('Avboka den här bokningen?')) return;
    setSaving(true);
    await fetch(`${API}/admin/bookings/${editing.id}`, { method: 'DELETE' });
    flash('Bokning avbokad'); setEditing(null); setSaving(false);
    view === 'day' ? await loadDay() : await loadWeek();
  };

  // ─── Filter options ──────────────────────────────────────────

  const courtOptions: FilterOption[] = allCourts.map(c => ({ id: c.courtId, label: c.courtName, sublabel: c.sportType }));
  const trainerOptions: FilterOption[] = trainers.map(t => ({ id: t.id, label: t.full_name }));
  const playerOptions: FilterOption[] = users.map(u => ({ id: u.id, label: u.full_name }));
  const clubOptions: FilterOption[] = clubs.map(c => ({ id: c.id, label: c.name }));

  const hasSelection = selected.size > 0;

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div>
      <div className="page-header">
        <h1>Schema</h1>
        <ViewTabs view={view} onChange={(v) => {
          setView(v);
          const q = new URLSearchParams(params.toString());
          q.set('view', v);
          router.replace(`/schedule?${q.toString()}`, { scroll: false });
        }} />
      </div>

      {toast && <div className="toast">{toast}</div>}

      <FilterBar
        clubs={clubOptions} selectedClubId={selectedClub} onClubChange={setSelectedClub}
        courts={courtOptions} selectedCourtId={filterCourt} onCourtChange={setFilterCourt}
        trainers={trainerOptions} selectedTrainerId={filterTrainer} onTrainerChange={setFilterTrainer}
        players={playerOptions} selectedPlayerId={filterPlayer} onPlayerChange={setFilterPlayer}
        bookingType={filterType} onBookingTypeChange={setFilterType}
        right={
          view === 'day' ? <DayNav date={date} onChange={setDate} /> :
          view === 'week' ? <WeekNav weekStart={weekStart} onChange={setWeekStart} /> :
          <div style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'flex-end' }}>{templates.length} mall{templates.length === 1 ? '' : 'ar'}</div>
        }
      />

      {loading ? <div className="loading">Laddar…</div> : (
        gridCourts.length === 0 ? <div className="empty-state">Inga banor.</div> : (
          <>
            <ScheduleGrid
              courts={gridCourts}
              days={gridDays}
              items={gridItems}
              selected={selected}
              onSelectChange={setSelected}
              onItemClick={onItemClick}
              rowHeight={view === 'week' ? 44 : 56}
            />

            {hasSelection && (
              <div style={{ marginTop: 18, padding: 14, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13 }}>
                    <strong>{selectionToSlots(selected).length}</strong> tidsluck{selectionToSlots(selected).length === 1 ? 'a vald' : 'or valda'}
                    {view === 'templates' && ' — skapar veckomallar'}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline" onClick={() => setSelected(new Set())}>Rensa</button>
                    <button className="btn btn-primary" onClick={openCreate}>
                      Skapa {view === 'templates' ? 'mall' : 'bokning'}…
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )
      )}

      {/* Create modal */}
      {creating && (
        <BookingModal
          mode="create"
          users={users}
          groups={groups as any}
          trainers={trainers}
          saving={saving}
          initialType={view === 'templates' ? 'training' : 'regular'}
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      {/* Apply-to-period preview modal (Templates view) */}
      {applyPreview && (
        <ApplyPreviewModal
          ruleId={applyPreview.ruleId}
          ruleTitle={applyPreview.ruleTitle}
          initialFrom={mondayOf(toDateStr(new Date()))}
          initialTo={addDays(mondayOf(toDateStr(new Date())), 7 * 8 - 1)}
          onClose={() => setApplyPreview(null)}
          onApplied={({ created }) => {
            flash(`Klart — ${created} bokning${created === 1 ? '' : 'ar'} skapade`);
            loadTemplates();
          }}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <BookingModal
          mode="edit"
          users={users}
          groups={groups as any}
          trainers={trainers}
          saving={saving}
          summary={{
            courtName: editing.courtName,
            startHour: editing.startHour,
            endHour: editing.endHour,
            totalPrice: editing.totalPrice,
            accessPin: editing.accessPin,
          }}
          initialType={editing.bookingType}
          initialStatus={editing.status as any}
          initialBookerId={editing.bookerId}
          initialTrainerId={editing.trainerId}
          initialPlayerIds={editing.playerIds}
          initialAttendeeIds={editing.eventAttendeeIds}
          initialNotes={editing.notes ?? ''}
          initialEventName={editing.eventName ?? ''}
          initialEventMax={String(editing.eventMaxParticipants ?? '')}
          initialTotalPrice={editing.totalPrice}
          bookingId={editing.id}
          onSave={handleEditSave}
          onDelete={handleEditDelete}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────

function ViewTabs({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const tabs: { key: View; label: string }[] = [
    { key: 'day', label: 'Dag' },
    { key: 'week', label: 'Vecka' },
    { key: 'templates', label: 'Mallar' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--bg-body)', padding: 4, borderRadius: 10 }}>
      {tabs.map(t => {
        const on = view === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            style={{
              padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: 'none', background: on ? 'var(--bg-card)' : 'transparent',
              color: on ? 'var(--text)' : 'var(--text-muted)',
              boxShadow: on ? 'var(--shadow-xs)' : 'none',
              transition: 'all 0.15s', fontFamily: 'inherit',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function DayNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <input type="date" value={date} onChange={e => onChange(e.target.value)} style={{ padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontFamily: 'inherit' }} />
      <button className="btn btn-outline" style={navBtn} onClick={() => onChange(addDays(date, -1))}>&larr;</button>
      <button className="btn btn-outline" style={navBtn} onClick={() => onChange(toDateStr(new Date()))}>Idag</button>
      <button className="btn btn-outline" style={navBtn} onClick={() => onChange(addDays(date, 1))}>&rarr;</button>
    </div>
  );
}

function WeekNav({ weekStart, onChange }: { weekStart: string; onChange: (d: string) => void }) {
  const weekEnd = addDays(weekStart, 6);
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 8 }}>{weekStart} — {weekEnd}</span>
      <button className="btn btn-outline" style={navBtn} onClick={() => onChange(addDays(weekStart, -7))}>&larr;</button>
      <button className="btn btn-outline" style={navBtn} onClick={() => onChange(mondayOf(toDateStr(new Date())))}>Denna vecka</button>
      <button className="btn btn-outline" style={navBtn} onClick={() => onChange(addDays(weekStart, 7))}>&rarr;</button>
    </div>
  );
}

const navBtn = { padding: '9px 12px', fontSize: 13 } as const;

// ─── Helpers ─────────────────────────────────────────────────────

function formatLongDate(s: string): string {
  const d = parseDate(s);
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function bookingToItem(b: Booking, courtId: string, dayKey: string): GridItem<Booking> {
  const variant: GridItem['variant'] = b.bookingType === 'regular' ? 'regular'
    : b.bookingType === 'training' ? 'training'
    : b.bookingType === 'contract' ? 'contract'
    : 'event';
  const title = b.bookingType === 'event' ? (b.eventName ?? 'Evenemang') : b.bookerName;
  let subtitle = '';
  if (b.bookingType === 'training' && b.trainerName) subtitle = b.trainerName;
  else if (b.bookingType === 'event') {
    const max = b.eventMaxParticipants;
    const spotsLeft = max ? max - b.attendeeCount : null;
    subtitle = spotsLeft === 0 ? 'Fullt' : spotsLeft !== null && spotsLeft <= 2 ? `${spotsLeft} plats${spotsLeft > 1 ? 'er' : ''} kvar` : `${b.attendeeCount}/${max ?? '∞'}`;
  }
  else if (b.bookingType === 'contract') subtitle = 'Veckovis';
  const caption = b.attendanceTotal > 0 ? `${b.attendancePresent}/${b.attendanceTotal}` : undefined;
  return {
    id: b.id, court_id: courtId, day_key: dayKey,
    start_hour: b.startHour, end_hour: b.endHour,
    variant, title, subtitle, caption, payload: b,
  };
}

function templateToItem(t: TrainingSession): GridItem<TrainingSession> {
  return {
    id: t.id,
    court_id: t.court_id,
    day_key: `T${t.day_of_week}`,
    start_hour: t.start_hour,
    end_hour: t.end_hour,
    variant: 'template',
    title: t.title,
    subtitle: t.trainer_name,
    caption: `${t.player_ids.length} spelare${t.applied_dates.length ? ` · tillämpad ${t.applied_dates.length}×` : ''}`,
    payload: t,
  };
}

function passesFilters(
  i: GridItem<Booking | TrainingSession>,
  filterTrainer: string | 'all',
  filterPlayer: string | 'all',
  filterType: 'all' | BType,
): boolean {
  const b = i.payload as Booking;
  if (filterType !== 'all' && b.bookingType !== filterType) return false;
  if (filterTrainer !== 'all' && b.trainerId !== filterTrainer) return false;
  if (filterPlayer !== 'all' && !b.playerIds?.includes(filterPlayer)) return false;
  // Suppress unused-destructure lint
  void parseCellKey;
  return true;
}
