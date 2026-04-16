/**
 * GET    /api/apply-batches/:batchId  — batch info
 * DELETE /api/apply-batches/:batchId  — undo (soft-cancel all bookings in batch)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: bookings } = await supabase.from('bookings').select('id, status, time_slot_start, recurrence_rule_id').eq('generation_batch_id', batchId);
  if (!bookings?.length) return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
  return NextResponse.json({
    success: true,
    data: {
      batch_id: batchId,
      rule_id: bookings[0].recurrence_rule_id,
      total: bookings.length,
      active: bookings.filter(b => b.status !== 'cancelled').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length,
      dates: [...new Set(bookings.map(b => b.time_slot_start?.split('T')[0]).filter(Boolean))].sort(),
    },
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('bookings')
    .update({ status: 'cancelled', cancellation_reason: 'Apply batch rolled back', updated_at: new Date().toISOString() })
    .eq('generation_batch_id', batchId)
    .neq('status', 'cancelled')
    .select('id');
  return NextResponse.json({ success: true, data: { cancelled: data?.length ?? 0 } });
}
