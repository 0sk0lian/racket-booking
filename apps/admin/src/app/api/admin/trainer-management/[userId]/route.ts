/**
 * PATCH /api/admin/trainer-management/:userId — Update trainer details
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/auth/guards';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { userId } = await params;
  const body = await request.json();
  const supabase = createSupabaseAdminClient();

  // Verify user exists
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  if (!user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (body.role !== undefined) updates.role = body.role;
  if (body.trainerClubId !== undefined) updates.trainer_club_id = body.trainerClubId;
  if (body.trainerSportTypes !== undefined) updates.trainer_sport_types = body.trainerSportTypes;
  if (body.trainerHourlyRate !== undefined) updates.trainer_hourly_rate = body.trainerHourlyRate;
  if (body.trainerMonthlySalary !== undefined) updates.trainer_monthly_salary = body.trainerMonthlySalary;
  if (body.trainerBio !== undefined) updates.trainer_bio = body.trainerBio;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
