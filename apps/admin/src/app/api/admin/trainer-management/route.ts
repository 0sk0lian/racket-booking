/**
 * GET /api/admin/trainer-management?clubId=
 * List all trainers at a club with full management info.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const clubId = request.nextUrl.searchParams.get('clubId');
  if (!clubId) {
    return NextResponse.json({ success: false, error: 'clubId is required' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('users')
    .select(
      'id, full_name, email, role, trainer_sport_types, trainer_hourly_rate, trainer_monthly_salary, trainer_club_id, trainer_bio, is_active',
    )
    .eq('trainer_club_id', clubId)
    .order('full_name');

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const trainers = (data ?? []).map((u) => ({
    id: u.id,
    fullName: u.full_name,
    email: u.email,
    role: u.role,
    trainerSportTypes: u.trainer_sport_types ?? [],
    trainerHourlyRate: u.trainer_hourly_rate ?? 0,
    trainerMonthlySalary: u.trainer_monthly_salary ?? 0,
    trainerClubId: u.trainer_club_id,
    trainerBio: u.trainer_bio,
    isActive: u.is_active,
  }));

  return NextResponse.json({ success: true, data: trainers });
}
