/**
 * GET   /api/admin/memberships?clubId=&status= — list memberships
 * PATCH /api/admin/memberships                  — approve/reject (body: { id, status, notes? })
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get('clubId');
  const status = request.nextUrl.searchParams.get('status');
  const supabase = createSupabaseAdminClient();

  let query = supabase.from('club_memberships').select('*');
  if (clubId) query = query.eq('club_id', clubId);
  if (status) query = query.eq('status', status);
  query = query.order('applied_at', { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Enrich with user names
  const userIds = [...new Set((data ?? []).map(m => m.user_id))];
  const { data: users } = userIds.length > 0
    ? await supabase.from('users').select('id, full_name, email').in('id', userIds)
    : { data: [] };
  const userMap = new Map((users ?? []).map(u => [u.id, u]));

  const enriched = (data ?? []).map(m => ({
    ...m,
    user_name: userMap.get(m.user_id)?.full_name ?? 'Unknown',
    user_email: userMap.get(m.user_id)?.email ?? null,
  }));

  return NextResponse.json({ success: true, data: enriched });
}

export async function PATCH(request: NextRequest) {
  const { id, status, notes } = await request.json();
  if (!id || !status) return NextResponse.json({ success: false, error: 'id and status required' }, { status: 400 });

  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();

  const supabase = createSupabaseAdminClient();
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'active') {
    updates.approved_at = new Date().toISOString();
    updates.approved_by = user?.id ?? null;
  }
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabase.from('club_memberships').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data });
}
