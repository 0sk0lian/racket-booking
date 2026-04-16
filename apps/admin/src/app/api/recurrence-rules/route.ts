/**
 * GET  /api/recurrence-rules?clubId=&type=&active=
 * POST /api/recurrence-rules
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const supabase = createSupabaseAdminClient();
  let query = supabase.from('recurrence_rules').select('*');
  if (p.get('clubId')) query = query.eq('club_id', p.get('clubId'));
  if (p.get('type')) query = query.eq('booking_type', p.get('type'));
  if (p.get('active') === 'true') query = query.eq('is_active', true);
  const { data, error } = await query.order('title');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const b = await request.json();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('recurrence_rules').insert({
    club_id: b.clubId, title: b.title, booking_type: b.bookingType ?? 'training',
    court_id: b.courtId, start_hour: b.startHour, end_hour: b.endHour,
    freq: b.freq ?? 'weekly', interval_n: b.intervalN ?? 1,
    weekdays: b.weekdays ?? [], start_date: b.startDate, end_date: b.endDate ?? null,
    skip_dates: b.skipDates ?? [], trainer_id: b.trainerId ?? null,
    player_ids: b.playerIds ?? [], event_name: b.eventName ?? null,
    event_max_participants: b.eventMaxParticipants ?? null,
    notes: b.notes ?? null, created_by: b.createdBy ?? null,
  }).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
