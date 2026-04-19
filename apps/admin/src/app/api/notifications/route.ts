/**
 * GET   /api/notifications?unreadOnly=true&limit=20  — list user's notifications
 * PATCH /api/notifications                            — mark notification(s) as read
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';
import { requireUser } from '../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const unreadOnly = request.nextUrl.searchParams.get('unreadOnly') === 'true';
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 20, 100);

  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq('read', false);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const supabase = createSupabaseAdminClient();

  if (body.markAllRead) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', auth.user.id)
      .eq('read', false);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (body.id) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', body.id)
      .eq('user_id', auth.user.id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json(
    { success: false, error: 'Provide { id } or { markAllRead: true }' },
    { status: 400 },
  );
}
