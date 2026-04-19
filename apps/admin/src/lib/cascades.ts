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
