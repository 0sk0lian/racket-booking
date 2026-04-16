/**
 * POST /api/recurrence-rules/:id/materialize?from=&to=
 * Creates bookings from the preview instances.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import crypto from 'crypto';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  // Re-use the preview logic by calling the preview endpoint internally
  const body = await request.json().catch(() => ({}));
  const from = request.nextUrl.searchParams.get('from') ?? body.from;
  const to = request.nextUrl.searchParams.get('to') ?? body.to;

  const { data: rule } = await supabase.from('recurrence_rules').select('*').eq('id', id).single();
  if (!rule) return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });

  // Fetch preview internally
  const previewUrl = new URL(`/api/recurrence-rules/${id}/preview`, request.nextUrl.origin);
  if (from) previewUrl.searchParams.set('from', from);
  if (to) previewUrl.searchParams.set('to', to);
  const previewRes = await fetch(previewUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const preview = await previewRes.json();
  if (!preview.success) return NextResponse.json(preview, { status: 400 });

  const batchId = crypto.randomUUID();
  const { data: court } = await supabase.from('courts').select('base_hourly_rate').eq('id', rule.court_id).single();
  const createdIds: string[] = [];

  for (const inst of preview.data.instances) {
    const durationHours = inst.end_hour - inst.start_hour;
    let totalPrice = 0;
    if (rule.booking_type !== 'event') {
      totalPrice = (court?.base_hourly_rate ?? 0) * durationHours * 1.05;
    }

    const { data: booking, error } = await supabase.from('bookings').insert({
      court_id: inst.court_id,
      booker_id: rule.created_by ?? null,
      time_slot_start: inst.start_iso,
      time_slot_end: inst.end_iso,
      status: 'confirmed',
      total_price: totalPrice,
      access_pin: String(Math.floor(100000 + Math.random() * 900000)),
      booking_type: rule.booking_type,
      trainer_id: rule.trainer_id,
      player_ids: rule.player_ids ?? [],
      event_name: rule.event_name,
      event_max_participants: rule.event_max_participants,
      notes: rule.notes,
      recurrence_rule_id: rule.id,
      generation_batch_id: batchId,
    }).select('id').single();

    if (booking) createdIds.push(booking.id);
  }

  return NextResponse.json({
    success: true,
    data: {
      rule_id: id,
      batch_id: batchId,
      created: createdIds.length,
      created_booking_ids: createdIds,
      conflicts: preview.data.conflicts,
      blackouts: preview.data.blackouts,
      skipped_dates: preview.data.skipped_dates,
    },
  });
}
