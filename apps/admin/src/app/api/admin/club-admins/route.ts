/**
 * Superadmin tenant management:
 * GET    /api/admin/club-admins?clubId=
 * POST   /api/admin/club-admins   { clubId, userId, role? }
 * DELETE /api/admin/club-admins   { clubId, userId }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireSuperadmin } from '../../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const superadmin = await requireSuperadmin();
  if (!superadmin.ok) return superadmin.response;

  const clubId = request.nextUrl.searchParams.get('clubId');
  const supabase = createSupabaseAdminClient();

  let query = supabase.from('club_admins').select('*');
  if (clubId) query = query.eq('club_id', clubId);
  const { data: assignments, error } = await query.order('created_at', { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const userIds = [...new Set((assignments ?? []).map((row) => row.user_id as string))];
  const clubIds = [...new Set((assignments ?? []).map((row) => row.club_id as string))];

  const [{ data: users }, { data: clubs }] = await Promise.all([
    userIds.length > 0 ? supabase.from('users').select('id, full_name, email, role').in('id', userIds) : { data: [] as any[] },
    clubIds.length > 0 ? supabase.from('clubs').select('id, name').in('id', clubIds) : { data: [] as any[] },
  ]);
  const userMap = new Map((users ?? []).map((row) => [row.id, row]));
  const clubMap = new Map((clubs ?? []).map((row) => [row.id, row]));

  const enriched = (assignments ?? []).map((row) => ({
    ...row,
    user_name: userMap.get(row.user_id)?.full_name ?? 'Unknown',
    user_email: userMap.get(row.user_id)?.email ?? null,
    user_role: userMap.get(row.user_id)?.role ?? null,
    club_name: clubMap.get(row.club_id)?.name ?? null,
  }));

  return NextResponse.json({ success: true, data: enriched });
}

export async function POST(request: NextRequest) {
  const superadmin = await requireSuperadmin();
  if (!superadmin.ok) return superadmin.response;

  const body = await request.json();
  const clubId = body?.clubId as string | undefined;
  const userId = body?.userId as string | undefined;
  const role = (body?.role as string | undefined) ?? 'admin';
  if (!clubId || !userId) {
    return NextResponse.json({ success: false, error: 'clubId and userId required' }, { status: 400 });
  }
  if (!['owner', 'admin', 'staff'].includes(role)) {
    return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: club }, { data: user }] = await Promise.all([
    supabase.from('clubs').select('id').eq('id', clubId).single(),
    supabase.from('users').select('id, role').eq('id', userId).single(),
  ]);
  if (!club) return NextResponse.json({ success: false, error: 'Club not found' }, { status: 404 });
  if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

  // Assigned tenant admins must have admin role in the platform model.
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    await supabase.from('users').update({ role: 'admin', updated_at: new Date().toISOString() }).eq('id', userId);
  }

  const { data, error } = await supabase.from('club_admins').upsert({
    club_id: clubId,
    user_id: userId,
    role,
  }, { onConflict: 'club_id,user_id' }).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest) {
  const superadmin = await requireSuperadmin();
  if (!superadmin.ok) return superadmin.response;

  const body = await request.json();
  const clubId = body?.clubId as string | undefined;
  const userId = body?.userId as string | undefined;
  if (!clubId || !userId) {
    return NextResponse.json({ success: false, error: 'clubId and userId required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('club_admins').delete().eq('club_id', clubId).eq('user_id', userId);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
