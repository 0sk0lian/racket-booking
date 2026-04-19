/**
 * POST /api/matchi/seasons/:id/copy — Copy subscriptions from one season to another
 * Body: { targetSeasonId }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../../lib/auth/guards';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id: sourceSeasonId } = await params;
  const body = await request.json();
  const { targetSeasonId } = body;

  if (!targetSeasonId) {
    return NextResponse.json({ success: false, error: 'targetSeasonId is required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Verify both seasons exist
  const { data: sourceSeason } = await supabase
    .from('seasons')
    .select('id, club_id')
    .eq('id', sourceSeasonId)
    .single();

  if (!sourceSeason) {
    return NextResponse.json({ success: false, error: 'Source season not found' }, { status: 404 });
  }

  const { data: targetSeason } = await supabase
    .from('seasons')
    .select('id, club_id')
    .eq('id', targetSeasonId)
    .single();

  if (!targetSeason) {
    return NextResponse.json({ success: false, error: 'Target season not found' }, { status: 404 });
  }

  // Fetch subscriptions from source season
  const { data: subscriptions, error: fetchError } = await supabase
    .from('subscriptions')
    .select('club_id, customer_id, court_id, day_of_week, start_hour, end_hour, price_per_session, frequency, status')
    .eq('season_id', sourceSeasonId);

  if (fetchError) {
    return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
  }

  const subs = subscriptions ?? [];
  if (subs.length === 0) {
    return NextResponse.json({ success: true, copied: 0 });
  }

  // Duplicate subscriptions to the target season
  const newSubs = subs.map((sub) => ({
    ...sub,
    season_id: targetSeasonId,
    club_id: targetSeason.club_id,
    status: 'active' as const,
  }));

  const { error: insertError } = await supabase
    .from('subscriptions')
    .insert(newSubs);

  if (insertError) {
    return NextResponse.json({ success: false, error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, copied: newSubs.length });
}
