/**
 * GET  /api/trainer-absences?clubId=&status=open  — list absences (for trainers to see claimable sessions)
 * POST /api/trainer-absences                       — trainer reports absence
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';
import { requireUser } from '../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const clubId = request.nextUrl.searchParams.get('clubId');
  const status = request.nextUrl.searchParams.get('status') ?? 'open';

  if (!clubId) {
    return NextResponse.json({ success: false, error: 'clubId required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('trainer_absences')
    .select('*')
    .eq('club_id', clubId)
    .eq('status', status)
    .order('session_date', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Enrich with trainer names
  const trainerIds = new Set<string>();
  (data ?? []).forEach(a => {
    trainerIds.add(a.trainer_id);
    if (a.claimed_by) trainerIds.add(a.claimed_by);
  });

  const { data: users } = trainerIds.size > 0
    ? await supabase.from('users').select('id, full_name').in('id', Array.from(trainerIds))
    : { data: [] };
  const userMap = new Map((users ?? []).map(u => [u.id, u.full_name]));

  const enriched = (data ?? []).map(a => ({
    ...a,
    trainer_name: userMap.get(a.trainer_id) ?? 'Unknown',
    claimed_by_name: a.claimed_by ? (userMap.get(a.claimed_by) ?? 'Unknown') : null,
  }));

  return NextResponse.json({ success: true, data: enriched });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { bookingId, reason } = body;

  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'bookingId required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Fetch the booking to get session details
  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select('id, court_id, trainer_id, time_slot_start, time_slot_end')
    .eq('id', bookingId)
    .single();

  if (bErr || !booking) {
    return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
  }

  // Verify the requesting user is the trainer on this booking
  if (booking.trainer_id !== auth.user.id && auth.role !== 'admin' && auth.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'You are not the trainer for this booking' }, { status: 403 });
  }

  // Get club_id from the court
  const { data: court } = await supabase
    .from('courts')
    .select('club_id')
    .eq('id', booking.court_id)
    .single();

  if (!court) {
    return NextResponse.json({ success: false, error: 'Court not found' }, { status: 404 });
  }

  const sessionDate = booking.time_slot_start.split('T')[0];
  const startHour = new Date(booking.time_slot_start).getHours();
  const endHour = new Date(booking.time_slot_end).getHours();

  const { data: absence, error: insertErr } = await supabase
    .from('trainer_absences')
    .insert({
      trainer_id: booking.trainer_id,
      club_id: court.club_id,
      booking_id: bookingId,
      session_date: sessionDate,
      session_start_hour: startHour,
      session_end_hour: endHour,
      reason: reason ?? null,
      status: 'open',
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: absence }, { status: 201 });
}
