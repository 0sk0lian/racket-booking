/**
 * GET /api/clubs/:id/events — upcoming events at a club
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../../lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clubId } = await params;
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  // Get courts for this club
  const { data: courts } = await supabase.from('courts').select('id, name').eq('club_id', clubId);
  const courtIds = (courts ?? []).map(c => c.id);
  if (courtIds.length === 0) return NextResponse.json({ success: true, data: [] });

  const { data: events, error } = await supabase
    .from('bookings')
    .select('*')
    .in('court_id', courtIds)
    .eq('booking_type', 'event')
    .neq('status', 'cancelled')
    .in('visibility', ['club', 'public'])
    .gte('time_slot_start', now)
    .order('time_slot_start');

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const courtMap = new Map((courts ?? []).map(c => [c.id, c]));

  // Check current user's signup status
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();

  const enriched = (events ?? []).map(e => ({
    id: e.id,
    event_name: e.event_name ?? 'Event',
    court_name: courtMap.get(e.court_id)?.name ?? '?',
    date: e.time_slot_start,
    start: e.time_slot_start,
    end: e.time_slot_end,
    max_participants: e.event_max_participants,
    attendee_count: (e.event_attendee_ids ?? []).length,
    spots_left: e.event_max_participants ? Math.max(0, e.event_max_participants - (e.event_attendee_ids ?? []).length) : null,
    is_full: e.event_max_participants ? (e.event_attendee_ids ?? []).length >= e.event_max_participants : false,
    user_signed_up: user ? (e.event_attendee_ids ?? []).includes(user.id) : false,
    notes: e.notes,
  }));

  return NextResponse.json({ success: true, data: enriched });
}
