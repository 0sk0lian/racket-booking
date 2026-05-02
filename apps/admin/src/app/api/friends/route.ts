/**
 * Friends API
 *
 * GET    — list my accepted friends + pending requests
 * POST   — send friend request  { friendId }
 * PATCH  — accept/block request { friendshipId, status }
 * DELETE — remove friend        ?id=
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';
import { requireUser } from '../../../lib/auth/guards';

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const userId = auth.user.id;

  // Get all friendships where I am either user_id or friend_id
  const { data: rows, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Collect all related user IDs for name enrichment
  const relatedIds = new Set<string>();
  for (const r of rows ?? []) {
    relatedIds.add(r.user_id);
    relatedIds.add(r.friend_id);
  }
  relatedIds.delete(userId);

  const { data: users } = relatedIds.size > 0
    ? await supabase.from('users').select('id, full_name, email').in('id', Array.from(relatedIds))
    : { data: [] };

  const userMap = new Map((users ?? []).map(u => [u.id, u]));

  // Split into accepted friends and pending requests
  const friends: unknown[] = [];
  const pendingIncoming: unknown[] = [];
  const pendingSent: unknown[] = [];

  for (const r of rows ?? []) {
    const otherId = r.user_id === userId ? r.friend_id : r.user_id;
    const other = userMap.get(otherId);

    const enriched = {
      id: r.id,
      userId: r.user_id,
      friendId: r.friend_id,
      status: r.status,
      createdAt: r.created_at,
      otherUser: other ? { id: other.id, fullName: other.full_name, email: other.email } : null,
    };

    if (r.status === 'accepted') {
      friends.push(enriched);
    } else if (r.status === 'pending') {
      if (r.friend_id === userId) {
        pendingIncoming.push(enriched);
      } else {
        pendingSent.push(enriched);
      }
    }
  }

  return NextResponse.json({ success: true, data: { friends, pendingIncoming, pendingSent } });
}

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const friendId = body.friendId;

  if (!friendId) {
    return NextResponse.json({ success: false, error: 'friendId required' }, { status: 400 });
  }

  if (friendId === auth.user.id) {
    return NextResponse.json({ success: false, error: 'Cannot add yourself' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Check if the target user exists
  const { data: targetUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', friendId)
    .maybeSingle();

  if (!targetUser) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  // Check for existing friendship in either direction
  const { data: existing } = await supabase
    .from('friendships')
    .select('id, status')
    .or(`and(user_id.eq.${auth.user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${auth.user.id})`)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ success: false, error: 'Friendship already exists', existing }, { status: 409 });
  }

  const { data, error } = await supabase
    .from('friendships')
    .insert({
      user_id: auth.user.id,
      friend_id: friendId,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { friendshipId, status } = body;

  if (!friendshipId || !status) {
    return NextResponse.json({ success: false, error: 'friendshipId and status required' }, { status: 400 });
  }

  if (!['accepted', 'blocked'].includes(status)) {
    return NextResponse.json({ success: false, error: 'status must be accepted or blocked' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Verify the request is addressed to this user (friend_id = me) and is still pending
  const { data: friendship } = await supabase
    .from('friendships')
    .select('*')
    .eq('id', friendshipId)
    .eq('friend_id', auth.user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (!friendship) {
    return NextResponse.json({ success: false, error: 'Pending request not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('friendships')
    .update({ status })
    .eq('id', friendshipId)
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ success: false, error: 'id query parameter required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Verify the user is part of this friendship
  const { data: friendship } = await supabase
    .from('friendships')
    .select('*')
    .eq('id', id)
    .or(`user_id.eq.${auth.user.id},friend_id.eq.${auth.user.id}`)
    .maybeSingle();

  if (!friendship) {
    return NextResponse.json({ success: false, error: 'Friendship not found' }, { status: 404 });
  }

  const { error } = await supabase.from('friendships').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
