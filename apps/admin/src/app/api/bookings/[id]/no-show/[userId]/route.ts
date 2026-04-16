import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../../lib/supabase/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id: bookingId, userId } = await params;
  const body = await request.json().catch(() => ({}));
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('attendance').upsert({
    booking_id: bookingId, user_id: userId, status: 'no_show',
    checked_in_at: now, checked_in_by: body.checkedInBy ?? null,
    responded_at: now, updated_at: now, created_at: now,
  }, { onConflict: 'booking_id,user_id' }).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data: { row: data, promotion: { promoted: null } } });
}
