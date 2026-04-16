/**
 * POST /api/events/:id/signup — player signs up for an event
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../../lib/supabase/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const { data: event } = await supabase.from('bookings').select('*').eq('id', eventId).eq('booking_type', 'event').single();
  if (!event) return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });

  const attendees = event.event_attendee_ids ?? [];
  if (attendees.includes(user.id)) {
    return NextResponse.json({ success: false, error: 'Already signed up' }, { status: 400 });
  }
  if (event.event_max_participants && attendees.length >= event.event_max_participants) {
    return NextResponse.json({ success: false, error: 'Event is full' }, { status: 400 });
  }

  const { error } = await supabase.from('bookings').update({
    event_attendee_ids: [...attendees, user.id],
    updated_at: new Date().toISOString(),
  }).eq('id', eventId);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  // Also create attendance row
  await supabase.from('attendance').upsert({
    booking_id: eventId, user_id: user.id, status: 'going',
    responded_at: new Date().toISOString(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: 'booking_id,user_id' });

  return NextResponse.json({ success: true, data: { signed_up: true } });
}
