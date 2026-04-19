/**
 * POST /api/training-planner/apply
 * Generate real bookings from training session templates over a date range.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../lib/auth/guards';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const { clubId, startDate, endDate, sessionIds } = await request.json();
  if (!clubId || !startDate || !endDate) {
    return NextResponse.json({ success: false, error: 'clubId, startDate, endDate required' }, { status: 400 });
  }
  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();

  let query = supabase.from('training_sessions').select('*').eq('club_id', clubId).neq('status', 'cancelled');
  if (sessionIds?.length) query = query.in('id', sessionIds);

  const { data: templates, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const batchId = crypto.randomUUID();
  const results: { sessionTitle: string; date: string; status: string; bookingId?: string; error?: string }[] = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    const dateStr = d.toISOString().split('T')[0];
    const dayTemplates = (templates ?? []).filter(t => t.day_of_week === dow);

    for (const t of dayTemplates) {
      if ((t.applied_dates ?? []).includes(dateStr)) {
        results.push({ sessionTitle: t.title, date: dateStr, status: 'skipped', error: 'Already applied' });
        continue;
      }

      const startTime = `${dateStr}T${String(t.start_hour).padStart(2, '0')}:00:00`;
      const endTime = `${dateStr}T${String(t.end_hour).padStart(2, '0')}:00:00`;

      const { data: booking, error: bErr } = await supabase.from('bookings').insert({
        court_id: t.court_id,
        booker_id: t.trainer_id,
        time_slot: `[${startTime},${endTime})`,
        time_slot_start: startTime,
        time_slot_end: endTime,
        status: 'confirmed',
        total_price: 0,
        access_pin: String(Math.floor(100000 + Math.random() * 900000)),
        booking_type: 'training',
        trainer_id: t.trainer_id,
        player_ids: t.player_ids ?? [],
        notes: `${t.title}${t.notes ? ' — ' + t.notes : ''}`,
        recurrence_rule_id: t.id,
        generation_batch_id: batchId,
      }).select().single();

      if (bErr) {
        results.push({ sessionTitle: t.title, date: dateStr, status: 'failed', error: bErr.code === '23P01' ? 'Already booked' : bErr.message });
      } else {
        // Mark applied date on the template
        await supabase.from('training_sessions').update({
          applied_dates: [...(t.applied_dates ?? []), dateStr],
          status: 'applied',
          updated_at: new Date().toISOString(),
        }).eq('id', t.id);
        // Update local copy so next iteration sees it
        t.applied_dates = [...(t.applied_dates ?? []), dateStr];
        results.push({ sessionTitle: t.title, date: dateStr, status: 'created', bookingId: booking?.id });
      }
    }
  }

  const created = results.filter(r => r.status === 'created').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status === 'failed').length;

  return NextResponse.json({ success: true, data: { created, skipped, failed, total: results.length, batchId, results } });
}
