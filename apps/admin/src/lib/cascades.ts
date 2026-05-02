/**
 * Cascade library — automatic side-effects triggered by domain events.
 *
 * Each function is fire-and-forget safe: failures are logged but never
 * propagate to the caller so the primary operation always succeeds.
 */
import { createSupabaseAdminClient } from './supabase/server';

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

/**
 * Called after a booking is created.
 * Creates attendance rows for every player (and trainer, when applicable).
 */
export async function onBookingCreated(booking: {
  id: string;
  court_id: string;
  player_ids?: string[];
  trainer_id?: string | null;
  booker_id: string;
  booking_type: string;
}) {
  const supabase = createSupabaseAdminClient();
  const attendees = new Set<string>();

  // Add all players
  (booking.player_ids ?? []).forEach(id => attendees.add(id));

  // Add trainer for training / contract bookings
  if (
    booking.trainer_id &&
    (booking.booking_type === 'training' || booking.booking_type === 'contract')
  ) {
    attendees.add(booking.trainer_id);
  }

  // For regular bookings the booker is the player
  if (booking.booking_type === 'regular' && booking.booker_id) {
    attendees.add(booking.booker_id);
  }

  if (attendees.size === 0) return;

  const rows = Array.from(attendees).map(userId => ({
    booking_id: booking.id,
    user_id: userId,
    status: 'invited',
  }));

  await supabase
    .from('attendance')
    .upsert(rows, { onConflict: 'booking_id,user_id', ignoreDuplicates: true });
}

/**
 * Called when a booking is cancelled.
 * Marks all non-cancelled attendance rows as cancelled.
 */
export async function onBookingCancelled(bookingId: string) {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('attendance')
    .update({ status: 'cancelled' })
    .eq('booking_id', bookingId)
    .neq('status', 'cancelled');
}

// ---------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------

/**
 * Called when a membership is approved (status becomes 'active').
 * 1. Looks up the membership type to derive an expiry date.
 * 2. Updates the membership row with the expiry.
 * 3. Adds the user to the club's first (default) group via player_ids array.
 */
export async function onMembershipApproved(membership: {
  id: string;
  club_id: string;
  user_id: string;
  membership_type: string;
  approved_by: string;
}) {
  const supabase = createSupabaseAdminClient();

  // 1. Look up the membership type to get the billing interval
  const { data: typeData } = await supabase
    .from('membership_types')
    .select('interval')
    .eq('club_id', membership.club_id)
    .eq('name', membership.membership_type)
    .eq('is_active', true)
    .maybeSingle();

  // 2. Calculate expiry date
  let expiresAt: string | null = null;
  if (typeData?.interval) {
    const now = new Date();
    switch (typeData.interval) {
      case 'month':
        now.setMonth(now.getMonth() + 1);
        break;
      case 'quarter':
        now.setMonth(now.getMonth() + 3);
        break;
      case 'half_year':
        now.setMonth(now.getMonth() + 6);
        break;
      case 'year':
        now.setFullYear(now.getFullYear() + 1);
        break;
      case 'once':
        break; // no expiry for one-time memberships
    }
    if (typeData.interval !== 'once') {
      expiresAt = now.toISOString();
    }
  }

  // 3. Update the membership with the calculated expiry
  if (expiresAt) {
    await supabase
      .from('club_memberships')
      .update({ expires_at: expiresAt })
      .eq('id', membership.id);
  }

  // 4. Add user to the club's default group (first created group).
  //    Groups store members as a UUID[] column (player_ids), so we
  //    use a Postgres array-append via RPC-style raw SQL.  The admin
  //    client bypasses RLS so a direct update is fine.
  const { data: defaultGroup } = await supabase
    .from('groups')
    .select('id, parent_group_id, player_ids')
    .eq('club_id', membership.club_id)
    .eq('is_active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle();

  if (defaultGroup) {
    const currentIds: string[] = defaultGroup.player_ids ?? [];
    if (!currentIds.includes(membership.user_id)) {
      await supabase
        .from('groups')
        .update({ player_ids: [...currentIds, membership.user_id] })
        .eq('id', defaultGroup.id);
    }

    // Also add to parent group if one exists
    if (defaultGroup.parent_group_id) {
      const { data: parentGroup } = await supabase
        .from('groups')
        .select('id, player_ids')
        .eq('id', defaultGroup.parent_group_id)
        .single();

      if (parentGroup) {
        const parentIds: string[] = parentGroup.player_ids ?? [];
        if (!parentIds.includes(membership.user_id)) {
          await supabase
            .from('groups')
            .update({ player_ids: [...parentIds, membership.user_id] })
            .eq('id', parentGroup.id);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Course → Training Planner auto-sync
// ---------------------------------------------------------------------------

/**
 * Called when course registrations are approved.
 * Auto-creates or updates a training session template in the planner
 * so approved students appear in the weekly schedule.
 *
 * Figma flow: Course → Apply form → Players placed in training planner
 */
export async function onCourseRegistrationsApproved(courseId: string) {
  const supabase = createSupabaseAdminClient();

  // 1. Fetch course details
  const { data: course } = await supabase
    .from('courses')
    .select('id, club_id, name, court_id, trainer_id, day_of_week, start_hour, end_hour, category')
    .eq('id', courseId)
    .single();

  if (!course || !course.court_id || course.day_of_week === null) return;

  // 2. Get all approved student IDs
  const { data: approved } = await supabase
    .from('course_registrations')
    .select('user_id')
    .eq('course_id', courseId)
    .eq('status', 'approved');

  const studentIds = (approved ?? []).map(r => r.user_id);

  // 3. Check if a training session template already exists for this course
  const { data: existing } = await supabase
    .from('training_sessions')
    .select('id, player_ids')
    .eq('club_id', course.club_id)
    .eq('court_id', course.court_id)
    .eq('day_of_week', course.day_of_week)
    .eq('start_hour', course.start_hour)
    .eq('end_hour', course.end_hour)
    .eq('trainer_id', course.trainer_id)
    .neq('status', 'cancelled')
    .maybeSingle();

  if (existing) {
    // Update existing template with the latest approved players
    const mergedIds = [...new Set([...(existing.player_ids ?? []), ...studentIds])];
    await supabase
      .from('training_sessions')
      .update({
        player_ids: mergedIds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    // Create new training session template from the course
    await supabase.from('training_sessions').insert({
      club_id: course.club_id,
      title: course.name,
      court_id: course.court_id,
      trainer_id: course.trainer_id,
      player_ids: studentIds,
      invited_ids: studentIds,
      day_of_week: course.day_of_week,
      start_hour: course.start_hour,
      end_hour: course.end_hour,
      group_id: null,
      notes: `Auto-synced from course: ${course.name}`,
      status: 'planned',
    });
  }
}

// ---------------------------------------------------------------------------
// Course sessions
// ---------------------------------------------------------------------------

/**
 * Called after course sessions are generated.
 * For each session, creates a booking on the schedule and links it back to
 * the course_session row, then creates attendance rows for registered users.
 */
export async function onCourseSessionsGenerated(
  sessions: Array<{
    id: string;
    course_id: string;
    date: string;
    start_hour: number;
    end_hour: number;
    court_id: string;
    trainer_id?: string | null;
  }>,
  courseClubId: string,
  registeredUserIds: string[],
) {
  const supabase = createSupabaseAdminClient();

  for (const session of sessions) {
    // Build proper timestamps from date + hour columns
    const startsAt = `${session.date}T${String(session.start_hour).padStart(2, '0')}:00:00`;
    const endsAt = `${session.date}T${String(session.end_hour).padStart(2, '0')}:00:00`;

    // Create a booking for the session
    const { data: booking } = await supabase
      .from('bookings')
      .insert({
        court_id: session.court_id,
        booker_id: session.trainer_id ?? registeredUserIds[0] ?? 'system',
        time_slot_start: startsAt,
        time_slot_end: endsAt,
        status: 'confirmed',
        booking_type: 'training',
        trainer_id: session.trainer_id ?? null,
        player_ids: registeredUserIds,
        notes: 'Course session',
      })
      .select('id')
      .single();

    if (!booking) continue;

    // Link the course_session back to the booking
    await supabase
      .from('course_sessions')
      .update({ booking_id: booking.id })
      .eq('id', session.id);

    // Create attendance rows for registered players
    const attendanceRows = registeredUserIds.map(userId => ({
      booking_id: booking.id,
      user_id: userId,
      status: 'invited',
    }));

    if (session.trainer_id) {
      attendanceRows.push({
        booking_id: booking.id,
        user_id: session.trainer_id,
        status: 'invited',
      });
    }

    if (attendanceRows.length > 0) {
      await supabase.from('attendance').upsert(attendanceRows, {
        onConflict: 'booking_id,user_id',
        ignoreDuplicates: true,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Group player removal
// ---------------------------------------------------------------------------

/**
 * Called when a player is removed from a group.
 * Removes the player from invited_ids and player_ids on all non-cancelled
 * training sessions linked to that group.
 */
export async function onPlayerRemovedFromGroup(params: {
  userId: string;
  groupId: string;
  clubId: string;
}) {
  const supabase = createSupabaseAdminClient();

  // Remove from future training session templates
  const { data: sessions } = await supabase
    .from('training_sessions')
    .select('id, invited_ids, player_ids')
    .eq('club_id', params.clubId)
    .eq('group_id', params.groupId)
    .neq('status', 'cancelled');

  for (const session of sessions ?? []) {
    const updates: Record<string, unknown> = {};
    const newInvited = (session.invited_ids ?? []).filter((id: string) => id !== params.userId);
    const newPlayers = (session.player_ids ?? []).filter((id: string) => id !== params.userId);

    if (newInvited.length !== (session.invited_ids ?? []).length) updates.invited_ids = newInvited;
    if (newPlayers.length !== (session.player_ids ?? []).length) updates.player_ids = newPlayers;

    if (Object.keys(updates).length > 0) {
      await supabase.from('training_sessions').update(updates).eq('id', session.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

/**
 * Detects scheduling conflicts for a proposed booking.
 * Returns warnings about trainer or player overlaps with existing bookings.
 */
export async function detectConflicts(params: {
  courtId: string;
  startTime: string;
  endTime: string;
  trainerId?: string;
  playerIds?: string[];
  excludeBookingId?: string;
}): Promise<{ type: string; message: string; bookingId: string }[]> {
  const supabase = createSupabaseAdminClient();
  const warnings: { type: string; message: string; bookingId: string }[] = [];

  // Check trainer conflicts
  if (params.trainerId) {
    let query = supabase
      .from('bookings')
      .select('id, time_slot_start, time_slot_end, court_id')
      .eq('trainer_id', params.trainerId)
      .neq('status', 'cancelled')
      .lt('time_slot_start', params.endTime)
      .gt('time_slot_end', params.startTime);

    if (params.excludeBookingId) {
      query = query.neq('id', params.excludeBookingId);
    }

    const { data: trainerConflicts } = await query;
    for (const conflict of trainerConflicts ?? []) {
      warnings.push({
        type: 'trainer_overlap',
        message: 'Trainer is already booked at this time',
        bookingId: conflict.id,
      });
    }
  }

  // Check player conflicts
  if (params.playerIds?.length) {
    for (const playerId of params.playerIds) {
      let query = supabase
        .from('bookings')
        .select('id, time_slot_start, time_slot_end, player_ids')
        .neq('status', 'cancelled')
        .lt('time_slot_start', params.endTime)
        .gt('time_slot_end', params.startTime)
        .contains('player_ids', [playerId]);

      if (params.excludeBookingId) {
        query = query.neq('id', params.excludeBookingId);
      }

      const { data: playerConflicts } = await query;
      for (const conflict of playerConflicts ?? []) {
        warnings.push({
          type: 'player_overlap',
          message: 'A player is already in another session at this time',
          bookingId: conflict.id,
        });
      }
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Group management
// ---------------------------------------------------------------------------

/**
 * Called when a player is manually added to a group.
 * Finds future training sessions linked to this group (via group_id column)
 * and adds the player to invited_ids + creates attendance for linked bookings.
 */
export async function onPlayerAddedToGroup(params: {
  userId: string;
  groupId: string;
  clubId: string;
}) {
  const supabase = createSupabaseAdminClient();

  // Find training sessions that reference this group
  const { data: sessions } = await supabase
    .from('training_sessions')
    .select('id, invited_ids')
    .eq('club_id', params.clubId)
    .eq('group_id', params.groupId)
    .neq('status', 'cancelled');

  if (!sessions?.length) return;

  const sessionIds: string[] = [];

  // Add user to invited_ids for each session
  for (const session of sessions) {
    sessionIds.push(session.id);
    const currentInvited: string[] = session.invited_ids ?? [];
    if (currentInvited.includes(params.userId)) continue;

    await supabase
      .from('training_sessions')
      .update({ invited_ids: [...currentInvited, params.userId] })
      .eq('id', session.id);
  }

  // Find future bookings that were generated from these sessions (via course_sessions)
  // and create attendance rows for the new player
  const { data: linkedBookings } = await supabase
    .from('course_sessions')
    .select('booking_id')
    .in('id', sessionIds)
    .not('booking_id', 'is', null);

  const bookingIds = (linkedBookings ?? [])
    .map(r => r.booking_id)
    .filter((id): id is string => !!id);

  if (bookingIds.length === 0) return;

  // Only target future bookings
  const { data: futureBookings } = await supabase
    .from('bookings')
    .select('id')
    .in('id', bookingIds)
    .neq('status', 'cancelled')
    .gt('time_slot_start', new Date().toISOString());

  for (const booking of futureBookings ?? []) {
    await supabase.from('attendance').upsert(
      { booking_id: booking.id, user_id: params.userId, status: 'invited' },
      { onConflict: 'booking_id,user_id', ignoreDuplicates: true },
    );
  }
}

// ---------------------------------------------------------------------------
// Blackout conflicts
// ---------------------------------------------------------------------------

/**
 * Called when a blackout period is created.
 * Returns conflicting bookings so the admin can decide what to do.
 */
export async function getBlackoutConflicts(params: {
  clubId: string;
  startsAt: string;
  endsAt: string;
  courtIds?: string[];
}): Promise<Array<{ id: string; court_id: string; time_slot_start: string; time_slot_end: string; booking_type: string; booker_name: string }>> {
  const supabase = createSupabaseAdminClient();

  // Get courts in scope
  let courtIds = params.courtIds;
  if (!courtIds?.length) {
    const { data: courts } = await supabase
      .from('courts')
      .select('id')
      .eq('club_id', params.clubId);
    courtIds = (courts ?? []).map(c => c.id);
  }

  if (!courtIds.length) return [];

  const { data: conflicts } = await supabase
    .from('bookings')
    .select('id, court_id, time_slot_start, time_slot_end, booking_type, booker_id')
    .in('court_id', courtIds)
    .neq('status', 'cancelled')
    .lt('time_slot_start', params.endsAt)
    .gt('time_slot_end', params.startsAt);

  if (!conflicts?.length) return [];

  const bookerIds = [...new Set(conflicts.map(c => c.booker_id))];
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', bookerIds);
  const userMap = new Map((users ?? []).map(u => [u.id, u.full_name]));

  return conflicts.map(c => ({
    id: c.id,
    court_id: c.court_id,
    time_slot_start: c.time_slot_start,
    time_slot_end: c.time_slot_end,
    booking_type: c.booking_type,
    booker_name: userMap.get(c.booker_id) ?? 'Unknown',
  }));
}

// ---------------------------------------------------------------------------
// Court deactivation
// ---------------------------------------------------------------------------

/**
 * Called when a court is deactivated.
 * Cancels all future bookings on that court and returns the count.
 */
export async function onCourtDeactivated(courtId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();

  const { data: futureBookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('court_id', courtId)
    .neq('status', 'cancelled')
    .gt('time_slot_start', new Date().toISOString());

  if (!futureBookings?.length) return 0;

  const ids = futureBookings.map(b => b.id);
  await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .in('id', ids);

  // Cascade attendance
  for (const id of ids) {
    await onBookingCancelled(id);
  }

  return ids.length;
}

// ---------------------------------------------------------------------------
// Trainer reassignment
// ---------------------------------------------------------------------------

/**
 * Called when a trainer is reassigned on a session.
 * Returns info for notification purposes.
 */
export async function onTrainerReassigned(params: {
  sessionId: string;
  oldTrainerId: string;
  newTrainerId: string;
}): Promise<{ oldTrainerName: string; newTrainerName: string }> {
  const supabase = createSupabaseAdminClient();

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', [params.oldTrainerId, params.newTrainerId]);

  const nameMap = new Map((users ?? []).map(u => [u.id, u.full_name ?? 'Unknown']));

  return {
    oldTrainerName: nameMap.get(params.oldTrainerId) ?? 'Unknown',
    newTrainerName: nameMap.get(params.newTrainerId) ?? 'Unknown',
  };
}

// ---------------------------------------------------------------------------
// Court lighting automation
// ---------------------------------------------------------------------------

/**
 * Called when a booking is created, to schedule court lights.
 * Turns lights on 5 minutes before the booking start and off at the end.
 * Only creates a schedule if the court has a hardware_relay_id configured.
 *
 * Note: The actual hardware API call (to Nox controllers) is NOT implemented
 * here — just the scheduling. When hardware is connected, a cron job will
 * check court_lighting_schedules and send commands.
 */
export async function onBookingCreatedLighting(booking: {
  id: string;
  court_id: string;
  time_slot_start: string;
  time_slot_end: string;
}) {
  const supabase = createSupabaseAdminClient();

  // Get court hardware relay
  const { data: court } = await supabase
    .from('courts')
    .select('hardware_relay_id')
    .eq('id', booking.court_id)
    .single();

  if (!court?.hardware_relay_id) return; // No hardware, skip

  // Schedule lights: on 5 min before, off at end
  const lightsOn = new Date(new Date(booking.time_slot_start).getTime() - 5 * 60000);
  const lightsOff = new Date(booking.time_slot_end);

  await supabase.from('court_lighting_schedules').upsert(
    {
      court_id: booking.court_id,
      booking_id: booking.id,
      lights_on_at: lightsOn.toISOString(),
      lights_off_at: lightsOff.toISOString(),
      hardware_relay_id: court.hardware_relay_id,
      status: 'scheduled',
    },
    { onConflict: 'booking_id' },
  );
}

// ---------------------------------------------------------------------------
// Opening hours conflicts
// ---------------------------------------------------------------------------

/**
 * Called when opening hours change for a venue.
 * Returns bookings that fall outside the new hours.
 */
export async function getOpeningHoursConflicts(params: {
  clubId: string;
  newOpeningHours: Array<{ day: number; open: string; close: string }>;
}): Promise<Array<{ id: string; court_id: string; time_slot_start: string; time_slot_end: string; conflict: string }>> {
  const supabase = createSupabaseAdminClient();

  const { data: courts } = await supabase
    .from('courts')
    .select('id')
    .eq('club_id', params.clubId);
  const courtIds = (courts ?? []).map(c => c.id);
  if (!courtIds.length) return [];

  // Get all future bookings
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, court_id, time_slot_start, time_slot_end')
    .in('court_id', courtIds)
    .neq('status', 'cancelled')
    .gt('time_slot_start', new Date().toISOString());

  const conflicts: Array<{ id: string; court_id: string; time_slot_start: string; time_slot_end: string; conflict: string }> = [];

  for (const b of bookings ?? []) {
    const start = new Date(b.time_slot_start);
    const end = new Date(b.time_slot_end);
    const dayOfWeek = start.getDay();

    const rule = params.newOpeningHours.find(h => h.day === dayOfWeek);
    if (!rule) continue;

    const openHour = parseInt(rule.open.split(':')[0]);
    const closeHour = parseInt(rule.close.split(':')[0]);

    if (start.getHours() < openHour || end.getHours() > closeHour) {
      conflicts.push({
        ...b,
        conflict: `Outside new hours ${rule.open}-${rule.close}`,
      });
    }
  }

  return conflicts;
}
