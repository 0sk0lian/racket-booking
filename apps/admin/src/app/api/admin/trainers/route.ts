/**
 * GET /api/admin/trainers?clubId=
 * Returns users with role='trainer' at the given club.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get('clubId');
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('users')
    .select('id, full_name, email, trainer_sport_types, trainer_hourly_rate, trainer_bio')
    .eq('role', 'trainer')
    .eq('is_active', true);

  if (clubId) query = query.eq('trainer_club_id', clubId);

  const { data, error } = await query.order('full_name');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Map to the shape the admin UI expects (legacy TrainerRow format)
  const trainers = (data ?? []).map(u => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    sport_types: u.trainer_sport_types ?? [],
    hourly_rate: u.trainer_hourly_rate ?? 0,
    bio: u.trainer_bio,
  }));

  return NextResponse.json({ success: true, data: trainers });
}
