/**
 * POST /api/trainings/:id/apply — player applies to join a training session
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../../lib/supabase/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const { data: session } = await supabase.from('training_sessions').select('*').eq('id', sessionId).single();
  if (!session) return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
  if (session.visibility === 'private') return NextResponse.json({ success: false, error: 'This session is invite-only' }, { status: 403 });

  // Check capacity
  if (session.max_players && (session.player_ids?.length ?? 0) >= session.max_players) {
    return NextResponse.json({ success: false, error: 'Session is full' }, { status: 400 });
  }

  // Check not already applied/assigned
  if ((session.player_ids ?? []).includes(user.id) ||
      (session.going_ids ?? []).includes(user.id) ||
      (session.invited_ids ?? []).includes(user.id)) {
    return NextResponse.json({ success: false, error: 'Already assigned to this session' }, { status: 400 });
  }

  // Add to invited_ids only. Admin/trainer decides final assignment.
  const updatedInvited = [...(session.invited_ids ?? []), user.id];

  await supabase.from('training_sessions').update({
    invited_ids: updatedInvited,
    updated_at: new Date().toISOString(),
  }).eq('id', sessionId);

  return NextResponse.json({ success: true, data: { status: 'applied', sessionId } });
}
