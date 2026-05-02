/**
 * Club Feed API
 *
 * GET    — list posts for a club (pinned first, then by date DESC)
 * POST   — admin creates a post  { content, pinned? }
 * DELETE — admin deletes a post   ?postId=
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../../lib/auth/guards';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: clubId } = await params;
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('club_feed_posts')
    .select('*')
    .eq('club_id', clubId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Enrich with author names
  const authorIds = [...new Set((data ?? []).map(p => p.author_id))];
  const { data: authors } = authorIds.length > 0
    ? await supabase.from('users').select('id, full_name').in('id', authorIds)
    : { data: [] };

  const authorMap = new Map((authors ?? []).map(a => [a.id, a.full_name]));

  const enriched = (data ?? []).map(p => ({
    ...p,
    author_name: authorMap.get(p.author_id) ?? 'Okänd',
  }));

  return NextResponse.json({ success: true, data: enriched });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: clubId } = await params;
  const clubAccess = await requireClubAccess(clubId);
  if (!clubAccess.ok) return clubAccess.response;

  const body = await request.json();
  if (!body?.content?.trim()) {
    return NextResponse.json({ success: false, error: 'content required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('club_feed_posts')
    .insert({
      club_id: clubId,
      author_id: clubAccess.user.id,
      content: body.content.trim(),
      pinned: body.pinned ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: clubId } = await params;
  const clubAccess = await requireClubAccess(clubId);
  if (!clubAccess.ok) return clubAccess.response;

  const url = new URL(request.url);
  const postId = url.searchParams.get('postId');

  if (!postId) {
    return NextResponse.json({ success: false, error: 'postId query parameter required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Verify post belongs to this club
  const { data: post } = await supabase
    .from('club_feed_posts')
    .select('id')
    .eq('id', postId)
    .eq('club_id', clubId)
    .maybeSingle();

  if (!post) {
    return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
  }

  const { error } = await supabase.from('club_feed_posts').delete().eq('id', postId);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
