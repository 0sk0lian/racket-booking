/**
 * GET   /api/admin/memberships?clubId=&status= — list memberships
 * PATCH /api/admin/memberships                  — approve/reject (body: { id, status, notes? })
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess, scopeClubIdsForAdmin } from '../../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const clubId = request.nextUrl.searchParams.get('clubId');
  const status = request.nextUrl.searchParams.get('status');
  const supabase = createSupabaseAdminClient();

  let scopedClubIds: string[] | null = null;
  if (clubId) {
    const access = await requireClubAccess(clubId);
    if (!access.ok) return access.response;
  } else {
    scopedClubIds = await scopeClubIdsForAdmin(admin);
  }

  let query = supabase.from('club_memberships').select('*');
  if (clubId) {
    query = query.eq('club_id', clubId);
  } else if (scopedClubIds !== null) {
    if (scopedClubIds.length === 0) return NextResponse.json({ success: true, data: [] });
    query = query.in('club_id', scopedClubIds);
  }
  if (status) query = query.eq('status', status);
  query = query.order('applied_at', { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const userIds = [...new Set((data ?? []).map((membership) => membership.user_id))];
  const { data: users } = userIds.length > 0
    ? await supabase.from('users').select('id, full_name, email').in('id', userIds)
    : { data: [] };
  const userMap = new Map((users ?? []).map((user) => [user.id, user]));

  const enriched = (data ?? []).map((membership) => ({
    ...membership,
    user_name: userMap.get(membership.user_id)?.full_name ?? 'Unknown',
    user_email: userMap.get(membership.user_id)?.email ?? null,
  }));

  return NextResponse.json({ success: true, data: enriched });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id, status, notes } = await request.json();
  if (!id || !status) {
    return NextResponse.json({ success: false, error: 'id and status required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: membership } = await supabase.from('club_memberships').select('id, club_id').eq('id', id).single();
  if (!membership) {
    return NextResponse.json({ success: false, error: 'Membership not found' }, { status: 404 });
  }

  const access = await requireClubAccess(membership.club_id);
  if (!access.ok) return access.response;

  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'active') {
    updates.approved_at = new Date().toISOString();
    updates.approved_by = admin.user.id;
  }
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabase.from('club_memberships').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data });
}
