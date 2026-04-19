import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';
import { requireAdmin, requireClubAccess, scopeClubIdsForAdmin } from '../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const requestedClubId = request.nextUrl.searchParams.get('clubId');
  if (requestedClubId) {
    const access = await requireClubAccess(requestedClubId);
    if (!access.ok) return access.response;
  }

  const scopedClubIds = requestedClubId ? [requestedClubId] : await scopeClubIdsForAdmin(admin);
  const supabase = createSupabaseAdminClient();

  if (scopedClubIds !== null && scopedClubIds.length === 0) {
    return NextResponse.json({ success: true, data: [] });
  }

  const baseSelect = 'id, email, full_name, phone_number, role, trainer_club_id, trainer_sport_types, trainer_hourly_rate, elo_padel, elo_tennis, elo_squash, elo_badminton, matches_played, is_active, created_at';

  if (scopedClubIds === null) {
    const { data, error } = await supabase.from('users').select(baseSelect).order('full_name');
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, data });
  }

  const [{ data: memberships }, { data: trainers }] = await Promise.all([
    supabase
      .from('club_memberships')
      .select('user_id, club_id, membership_type, status')
      .in('club_id', scopedClubIds),
    supabase
      .from('users')
      .select('id')
      .eq('role', 'trainer')
      .in('trainer_club_id', scopedClubIds),
  ]);

  const membershipByUser = new Map<string, { club_id: string; membership_type: string; status: string }>();
  for (const row of memberships ?? []) {
    if (!membershipByUser.has(row.user_id) || row.status === 'active') {
      membershipByUser.set(row.user_id, {
        club_id: row.club_id,
        membership_type: row.membership_type,
        status: row.status,
      });
    }
  }

  const userIds = new Set<string>([
    ...(memberships ?? []).map((row) => row.user_id as string),
    ...(trainers ?? []).map((row) => row.id as string),
  ]);
  if (userIds.size === 0) return NextResponse.json({ success: true, data: [] });

  const { data: users, error } = await supabase
    .from('users')
    .select(baseSelect)
    .in('id', [...userIds])
    .order('full_name');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const enriched = (users ?? []).map((user) => ({
    ...user,
    membership_type: membershipByUser.get(user.id)?.membership_type ?? null,
    membership_status: membershipByUser.get(user.id)?.status ?? null,
    membership_club_id: membershipByUser.get(user.id)?.club_id ?? null,
  }));

  return NextResponse.json({ success: true, data: enriched });
}
