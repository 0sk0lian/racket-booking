/**
 * GET  /api/trainer-absences?clubId=&status=open - list reported absences
 * POST /api/trainer-absences                     - report absence for a specific session
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';
import { requireClubAccess, requireUser } from '../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const clubId = request.nextUrl.searchParams.get('clubId');
  const status = request.nextUrl.searchParams.get('status') ?? 'open';

  if (!clubId) {
    return NextResponse.json({ success: false, error: 'clubId required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  if (auth.role === 'trainer') {
    const { data: trainer } = await supabase
      .from('users')
      .select('trainer_club_id')
      .eq('id', auth.user.id)
      .single();
    if ((trainer?.trainer_club_id as string | null) !== clubId) {
      return NextResponse.json({ success: false, error: 'Du har inte tillgång till denna klubb' }, { status: 403 });
    }
  } else {
    const access = await requireClubAccess(clubId);
    if (!access.ok) return access.response;
  }

  let query = supabase
    .from('trainer_absences')
    .select('*')
    .eq('club_id', clubId)
    .order('session_date', { ascending: true });
  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const trainerIds = new Set<string>();
  (data ?? []).forEach((absence) => {
    trainerIds.add(absence.trainer_id);
    if (absence.claimed_by) trainerIds.add(absence.claimed_by);
  });

  const { data: users } = trainerIds.size > 0
    ? await supabase.from('users').select('id, full_name').in('id', Array.from(trainerIds))
    : { data: [] as any[] };
  const userMap = new Map((users ?? []).map((user) => [user.id, user.full_name]));

  const enriched = (data ?? []).map((absence) => ({
    ...absence,
    trainer_name: userMap.get(absence.trainer_id) ?? 'Okänd tränare',
    claimed_by_name: absence.claimed_by ? (userMap.get(absence.claimed_by) ?? 'Okänd tränare') : null,
  }));

  return NextResponse.json({ success: true, data: enriched });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const bookingId = body?.bookingId as string | undefined;
  const reason = body?.reason as string | undefined;

  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'bookingId required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, court_id, trainer_id, time_slot_start, time_slot_end')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json({ success: false, error: 'Passet hittades inte' }, { status: 404 });
  }

  if (booking.trainer_id !== auth.user.id && auth.role !== 'admin' && auth.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Du är inte tränare för detta pass' }, { status: 403 });
  }

  const { data: court } = await supabase
    .from('courts')
    .select('club_id')
    .eq('id', booking.court_id)
    .single();

  if (!court?.club_id) {
    return NextResponse.json({ success: false, error: 'Banan hittades inte' }, { status: 404 });
  }

  if (auth.role !== 'trainer') {
    const access = await requireClubAccess(court.club_id);
    if (!access.ok) return access.response;
  }

  const sessionDate = booking.time_slot_start.split('T')[0];
  const startHour = new Date(booking.time_slot_start).getHours();
  const endHour = new Date(booking.time_slot_end).getHours();

  const { data: existing } = await supabase
    .from('trainer_absences')
    .select('id, status')
    .eq('booking_id', bookingId)
    .maybeSingle();
  if (existing && existing.status !== 'cancelled') {
    return NextResponse.json({ success: false, error: 'Det finns redan en frånvarorapport för detta pass' }, { status: 400 });
  }

  const { data: absence, error: insertError } = await supabase
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

  if (insertError) {
    return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: absence }, { status: 201 });
}
