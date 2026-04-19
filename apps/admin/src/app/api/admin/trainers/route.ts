/**
 * GET /api/admin/trainers?clubId=
 * Returns users with role='trainer' at the given club.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess, scopeClubIdsForAdmin } from '../../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const clubId = request.nextUrl.searchParams.get('clubId');
  if (clubId) {
    const access = await requireClubAccess(clubId);
    if (!access.ok) return access.response;
  }

  const scopedClubIds = clubId ? [clubId] : await scopeClubIdsForAdmin(admin);
  if (scopedClubIds !== null && scopedClubIds.length === 0) {
    return NextResponse.json({ success: true, data: [] });
  }

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('users')
    .select('id, full_name, email, trainer_club_id, trainer_sport_types, trainer_hourly_rate, trainer_bio')
    .eq('role', 'trainer')
    .eq('is_active', true);

  if (scopedClubIds !== null) query = query.in('trainer_club_id', scopedClubIds);

  const { data, error } = await query.order('full_name');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const trainers = (data ?? []).map((trainer) => ({
    id: trainer.id,
    full_name: trainer.full_name,
    email: trainer.email,
    trainer_club_id: trainer.trainer_club_id,
    sport_types: trainer.trainer_sport_types ?? [],
    hourly_rate: trainer.trainer_hourly_rate ?? 0,
    bio: trainer.trainer_bio,
  }));

  return NextResponse.json({ success: true, data: trainers });
}
