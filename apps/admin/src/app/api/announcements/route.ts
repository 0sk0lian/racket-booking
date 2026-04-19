/**
 * GET    /api/announcements?clubId=        — list announcements for a club
 * POST   /api/announcements                — create announcement (admin)
 * DELETE  /api/announcements?id=            — delete announcement (admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';
import { requireUser, requireClubAccess } from '../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const clubId = request.nextUrl.searchParams.get('clubId');
  if (!clubId) {
    return NextResponse.json({ success: false, error: 'clubId required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('club_id', clubId)
    .order('pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { clubId, title, body: announcementBody, pinned } = body;

  if (!clubId || !title || !announcementBody) {
    return NextResponse.json({ success: false, error: 'clubId, title, and body required' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('announcements')
    .insert({
      club_id: clubId,
      title,
      body: announcementBody,
      pinned: pinned ?? false,
      author_id: access.user.id,
      published_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Fetch announcement to verify club access
  const { data: announcement } = await supabase
    .from('announcements')
    .select('id, club_id')
    .eq('id', id)
    .single();

  if (!announcement) {
    return NextResponse.json({ success: false, error: 'Announcement not found' }, { status: 404 });
  }

  const access = await requireClubAccess(announcement.club_id);
  if (!access.ok) return access.response;

  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
