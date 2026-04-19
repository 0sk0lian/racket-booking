/**
 * GET /api/matchi/statements?clubId= — List monthly statements with summary
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get('clubId');
  if (!clubId) {
    return NextResponse.json({ success: false, error: 'clubId is required' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();

  const { data: statements, error } = await supabase
    .from('statements')
    .select('*')
    .eq('club_id', clubId)
    .order('period', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const rows = statements ?? [];

  const summary = {
    total_earned: rows.reduce((sum, s) => sum + Number(s.total_earned), 0),
    total_paid: rows.reduce((sum, s) => sum + Number(s.total_paid_out), 0),
    pending_total: rows.reduce((sum, s) => sum + Number(s.pending_payout), 0),
  };

  return NextResponse.json({ success: true, summary, statements: rows });
}
