import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, phone_number, role, trainer_club_id, trainer_sport_types, trainer_hourly_rate, elo_padel, elo_tennis, elo_squash, elo_badminton, matches_played, is_active, created_at')
    .order('full_name');

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}
