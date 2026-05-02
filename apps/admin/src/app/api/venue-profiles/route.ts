import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';
import { resolveClubId } from '../../../lib/clubs';

export async function GET(request: NextRequest) {
  const clubIdentifier = request.nextUrl.searchParams.get('clubId');
  const supabase = createSupabaseAdminClient();
  const clubId = clubIdentifier ? await resolveClubId(clubIdentifier, supabase) : null;
  if (clubIdentifier && !clubId) {
    return NextResponse.json({ success: false, error: 'Club not found' }, { status: 404 });
  }
  let query = supabase.from('venue_profiles').select('*');
  if (clubId) query = query.eq('club_id', clubId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}
