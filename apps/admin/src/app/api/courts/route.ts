import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';
import { getRequestUser, getUserRole, getManagedClubIds } from '../../../lib/auth/guards';
import { resolveClubId } from '../../../lib/clubs';

export async function GET(request: NextRequest) {
  const clubIdentifier = request.nextUrl.searchParams.get('clubId');
  const supabase = createSupabaseAdminClient();
  const clubId = clubIdentifier ? await resolveClubId(clubIdentifier, supabase) : null;

  if (clubIdentifier && !clubId) {
    return NextResponse.json({ success: false, error: 'Club not found' }, { status: 404 });
  }

  const requestUser = await getRequestUser();
  let scopedClubIds: string[] | null = null;
  if (requestUser) {
    const role = await getUserRole(requestUser.id);
    if (role === 'admin') {
      scopedClubIds = await getManagedClubIds(requestUser.id);
    }
  }

  let query = supabase.from('courts').select('*').eq('is_active', true).order('name');
  if (clubId) {
    if (scopedClubIds !== null && !scopedClubIds.includes(clubId)) {
      return NextResponse.json({ success: false, error: 'You do not have access to this venue' }, { status: 403 });
    }
    query = query.eq('club_id', clubId);
  } else if (scopedClubIds !== null) {
    if (scopedClubIds.length === 0) return NextResponse.json({ success: true, data: [] });
    query = query.in('club_id', scopedClubIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}
