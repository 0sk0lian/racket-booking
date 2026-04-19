/**
 * POST /api/matchi/public-matches/:id/join — Add a user to a public match
 * Body: { userId }
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

  const { id: matchId } = await params;
  const body = await request.json();
  const { userId } = body;

  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Fetch the current match
  const { data: match, error: fetchError } = await supabase
    .from('public_matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (fetchError || !match) {
    return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 });
  }

  if (match.status !== 'open') {
    return NextResponse.json({ success: false, error: 'Match is not open for joining' }, { status: 400 });
  }

  if (match.spots_filled >= match.spots_total) {
    return NextResponse.json({ success: false, error: 'Match is full' }, { status: 400 });
  }

  const currentPlayers: string[] = Array.isArray(match.player_ids) ? match.player_ids : [];
  if (currentPlayers.includes(userId)) {
    return NextResponse.json({ success: false, error: 'User is already in this match' }, { status: 400 });
  }

  const updatedPlayers = [...currentPlayers, userId];
  const newSpotsFilled = match.spots_filled + 1;
  const newStatus = newSpotsFilled >= match.spots_total ? 'full' : 'open';

  const { data: updated, error: updateError } = await supabase
    .from('public_matches')
    .update({
      player_ids: updatedPlayers,
      spots_filled: newSpotsFilled,
      status: newStatus,
    })
    .eq('id', matchId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: updated,
    spots_remaining: updated.spots_total - updated.spots_filled,
  });
}
