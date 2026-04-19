/**
 * GET  /api/clubs/:id/membership — check current user's membership status
 * POST /api/clubs/:id/membership — apply for membership
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../../lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clubId } = await params;
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: true, data: { status: 'none' } });
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('club_memberships')
    .select('*').eq('club_id', clubId).eq('user_id', user.id).single();

  return NextResponse.json({ success: true, data: data ?? { status: 'none' } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clubId } = await params;
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

  const supabase = createSupabaseAdminClient();

  // Check not already a member
  const { data: existing } = await supabase.from('club_memberships')
    .select('status').eq('club_id', clubId).eq('user_id', user.id).single();
  if (existing?.status === 'active') {
    return NextResponse.json({ success: false, error: 'Already a member' }, { status: 400 });
  }
  if (existing?.status === 'pending') {
    return NextResponse.json({ success: false, error: 'Application already pending' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const { data, error } = await supabase.from('club_memberships').upsert({
    club_id: clubId,
    user_id: user.id,
    status: 'pending',
    membership_type: body.membershipType ?? 'standard',
    form_answers: body.formAnswers ?? {},
    notes: body.notes ?? null,
    applied_at: new Date().toISOString(),
  }, { onConflict: 'club_id,user_id' }).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
