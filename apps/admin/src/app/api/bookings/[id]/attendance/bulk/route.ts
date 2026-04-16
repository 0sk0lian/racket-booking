import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../../lib/supabase/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await params;
  const { status, userIds } = await request.json();
  if (!status || !Array.isArray(userIds)) {
    return NextResponse.json({ success: false, error: 'body must be { status, userIds[] }' }, { status: 400 });
  }
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const rows = [];
  for (const uid of userIds) {
    const { data } = await supabase.from('attendance').upsert({
      booking_id: bookingId, user_id: uid, status, responded_at: now, updated_at: now,
    }, { onConflict: 'booking_id,user_id' }).select().single();
    if (data) rows.push(data);
  }
  return NextResponse.json({ success: true, data: { rows, promotions: [] } });
}
