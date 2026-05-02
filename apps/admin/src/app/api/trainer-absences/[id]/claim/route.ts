/**
 * POST /api/trainer-absences/[id]/claim
 * Claim or assign an open replacement pass.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireClubAccess, requireUser } from '../../../../../lib/auth/guards';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const requestedTrainerId = body?.trainerId as string | undefined;

  const supabase = createSupabaseAdminClient();
  const { data: absence, error: absenceError } = await supabase
    .from('trainer_absences')
    .select('*')
    .eq('id', id)
    .single();

  if (absenceError || !absence) {
    return NextResponse.json({ success: false, error: 'Frånvaroposten hittades inte' }, { status: 404 });
  }

  if (absence.status !== 'open') {
    return NextResponse.json({ success: false, error: 'Detta pass har redan tagits över eller stängts' }, { status: 400 });
  }

  let claimTrainerId = auth.user.id;
  if (auth.role === 'trainer') {
    if (requestedTrainerId && requestedTrainerId !== auth.user.id) {
      return NextResponse.json({ success: false, error: 'Du kan bara ta över pass åt dig själv' }, { status: 403 });
    }
  } else {
    const access = await requireClubAccess(absence.club_id);
    if (!access.ok) return access.response;
    claimTrainerId = requestedTrainerId || auth.user.id;
  }

  if (claimTrainerId === absence.trainer_id) {
    return NextResponse.json({ success: false, error: 'Frånvarande tränare kan inte ta över sitt eget pass' }, { status: 400 });
  }

  const { data: replacementTrainer } = await supabase
    .from('users')
    .select('id, role, trainer_club_id')
    .eq('id', claimTrainerId)
    .single();

  if (!replacementTrainer || replacementTrainer.role !== 'trainer' || replacementTrainer.trainer_club_id !== absence.club_id) {
    return NextResponse.json({ success: false, error: 'Ersättaren måste vara en tränare i samma klubb' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error: updateAbsenceError } = await supabase
    .from('trainer_absences')
    .update({
      status: 'claimed',
      claimed_by: claimTrainerId,
      claimed_at: now,
    })
    .eq('id', id)
    .eq('status', 'open');

  if (updateAbsenceError) {
    return NextResponse.json({ success: false, error: updateAbsenceError.message }, { status: 500 });
  }

  if (absence.booking_id) {
    const { error: updateBookingError } = await supabase
      .from('bookings')
      .update({ trainer_id: claimTrainerId })
      .eq('id', absence.booking_id);

    if (updateBookingError) {
      console.error('Failed to update booking trainer_id:', updateBookingError.message);
    }
  }

  const sessionHours = absence.session_end_hour && absence.session_start_hour
    ? absence.session_end_hour - absence.session_start_hour
    : 1;

  if (absence.booking_id) {
    const { error: deleteError } = await supabase
      .from('time_reports')
      .delete()
      .eq('user_id', absence.trainer_id)
      .eq('booking_id', absence.booking_id)
      .eq('approved', false);

    if (deleteError) {
      console.error('Failed to remove absent trainer time report:', deleteError.message);
    }
  }

  const { error: reportError } = await supabase
    .from('time_reports')
    .insert({
      user_id: claimTrainerId,
      club_id: absence.club_id,
      date: absence.session_date,
      hours: sessionHours,
      type: 'training',
      description: 'Vikariepass - övertog pass efter frånvaro',
      booking_id: absence.booking_id,
      approved: false,
    });

  if (reportError) {
    console.error('Failed to create substitute time report:', reportError.message);
  }

  return NextResponse.json({
    success: true,
    data: {
      absence_id: id,
      claimed_by: claimTrainerId,
      booking_id: absence.booking_id,
      session_date: absence.session_date,
      hours_transferred: sessionHours,
    },
  });
}
