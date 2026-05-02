import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../../lib/supabase/server';
import { requireBookingTrainerOrAdmin } from '../../../../../../lib/booking-access';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id: bookingId, userId } = await params;
  const access = await requireBookingTrainerOrAdmin(bookingId);
  if (!access.ok) return access.response;

  const { status, checkedInBy } = await request.json();
  const valid = ['invited', 'going', 'declined', 'waitlist', 'present', 'no_show'];
  if (!status || !valid.includes(status)) {
    return NextResponse.json({ success: false, error: `status must be one of ${valid.join(', ')}` }, { status: 400 });
  }
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status, updated_at: now };
  if (['going', 'declined', 'waitlist'].includes(status)) updates.responded_at = now;
  if (['present', 'no_show'].includes(status)) {
    updates.checked_in_at = now;
    updates.checked_in_by = checkedInBy || access.userId;
  }

  const { data, error } = await supabase.from('attendance').upsert({
    booking_id: bookingId, user_id: userId, ...updates, created_at: now,
  }, { onConflict: 'booking_id,user_id' }).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data: { row: data, promotion: { promoted: null } } });
}
