/**
 * POST /api/trainer-absences/[id]/claim
 * Another trainer claims an open absence session.
 * Updates absence status to 'claimed', reassigns the booking's trainer_id,
 * and creates time report adjustments for both trainers.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireUser } from '../../../../../lib/auth/guards';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  // 1. Fetch the absence
  const { data: absence, error: aErr } = await supabase
    .from('trainer_absences')
    .select('*')
    .eq('id', id)
    .single();

  if (aErr || !absence) {
    return NextResponse.json({ success: false, error: 'Absence not found' }, { status: 404 });
  }

  if (absence.status !== 'open') {
    return NextResponse.json({ success: false, error: 'This absence has already been claimed or cancelled' }, { status: 400 });
  }

  // Cannot claim your own absence
  if (absence.trainer_id === auth.user.id) {
    return NextResponse.json({ success: false, error: 'You cannot claim your own absence' }, { status: 400 });
  }

  // Verify claiming user is a trainer (or admin)
  if (auth.role !== 'trainer' && auth.role !== 'admin' && auth.role !== 'superadmin') {
    return NextResponse.json({ success: false, error: 'Only trainers can claim absences' }, { status: 403 });
  }

  const now = new Date().toISOString();

  // 2. Update absence: mark as claimed
  const { error: updateAbsErr } = await supabase
    .from('trainer_absences')
    .update({
      status: 'claimed',
      claimed_by: auth.user.id,
      claimed_at: now,
    })
    .eq('id', id)
    .eq('status', 'open'); // optimistic lock

  if (updateAbsErr) {
    return NextResponse.json({ success: false, error: updateAbsErr.message }, { status: 500 });
  }

  // 3. Update the booking's trainer_id to the claiming trainer
  if (absence.booking_id) {
    const { error: updateBookingErr } = await supabase
      .from('bookings')
      .update({ trainer_id: auth.user.id })
      .eq('id', absence.booking_id);

    if (updateBookingErr) {
      // Log but don't fail — the claim itself succeeded
      console.error('Failed to update booking trainer_id:', updateBookingErr.message);
    }
  }

  // 4. Create time report for the substitute trainer
  // Note: the absent trainer's existing time report (if any) should be
  // removed/unapproved by admin. We only create the substitute's entry here.
  const sessionHours = absence.session_end_hour && absence.session_start_hour
    ? absence.session_end_hour - absence.session_start_hour
    : 1;

  // Remove any existing unapproved time report for the absent trainer on this booking
  if (absence.booking_id) {
    const { error: delErr } = await supabase
      .from('time_reports')
      .delete()
      .eq('user_id', absence.trainer_id)
      .eq('booking_id', absence.booking_id)
      .eq('approved', false);

    if (delErr) {
      console.error('Failed to remove absent trainer time report:', delErr.message);
    }
  }

  // Positive time report for the substitute trainer
  const { error: trPos } = await supabase
    .from('time_reports')
    .insert({
      user_id: auth.user.id,
      club_id: absence.club_id,
      date: absence.session_date,
      hours: sessionHours,
      type: 'training',
      description: `Vikarie — overtog pass fran sjukanmald tranare`,
      booking_id: absence.booking_id,
      approved: false,
    });

  if (trPos) {
    console.error('Failed to create substitute time report:', trPos.message);
  }

  return NextResponse.json({
    success: true,
    data: {
      absence_id: id,
      claimed_by: auth.user.id,
      booking_id: absence.booking_id,
      session_date: absence.session_date,
      hours_transferred: sessionHours,
    },
  });
}
