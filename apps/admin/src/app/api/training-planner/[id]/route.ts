/**
 * PATCH  /api/training-planner/:id  — update template
 * DELETE /api/training-planner/:id  — soft-delete (status='cancelled')
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../lib/auth/guards';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = createSupabaseAdminClient();

  const { data: session } = await supabase.from('training_sessions').select('id, club_id').eq('id', id).single();
  if (!session) return NextResponse.json({ success: false, error: 'Training session not found' }, { status: 404 });
  const access = await requireClubAccess(session.club_id);
  if (!access.ok) return access.response;

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.courtId !== undefined) updates.court_id = body.courtId;
  if (body.trainerId !== undefined) updates.trainer_id = body.trainerId;
  if (body.playerIds !== undefined) updates.player_ids = body.playerIds;
  if (body.dayOfWeek !== undefined) updates.day_of_week = body.dayOfWeek;
  if (body.startHour !== undefined) updates.start_hour = body.startHour;
  if (body.endHour !== undefined) updates.end_hour = body.endHour;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.goingIds !== undefined) updates.going_ids = body.goingIds;
  if (body.declinedIds !== undefined) updates.declined_ids = body.declinedIds;
  if (body.invitedIds !== undefined) updates.invited_ids = body.invitedIds;
  if (body.waitlistIds !== undefined) updates.waitlist_ids = body.waitlistIds;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('training_sessions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: session } = await supabase.from('training_sessions').select('id, club_id').eq('id', id).single();
  if (!session) return NextResponse.json({ success: false, error: 'Training session not found' }, { status: 404 });
  const access = await requireClubAccess(session.club_id);
  if (!access.ok) return access.response;

  const { error } = await supabase
    .from('training_sessions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
