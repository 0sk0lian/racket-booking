/**
 * POST /api/matches/:id/join — join an open match
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../../lib/supabase/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params;
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const { data: match } = await supabase.from('public_matches').select('*').eq('id', matchId).single();
  if (!match) return NextResponse.json({ success: false, error: 'Match not found' }, { status: 404 });
  if (match.status !== 'open') return NextResponse.json({ success: false, error: 'Match is not open' }, { status: 400 });

  const players = match.player_ids ?? [];
  if (players.includes(user.id)) return NextResponse.json({ success: false, error: 'Already joined' }, { status: 400 });
  if (players.length >= match.spots_total) return NextResponse.json({ success: false, error: 'Match is full' }, { status: 400 });

  const newPlayers = [...players, user.id];
  const newFilled = newPlayers.length;
  const newStatus = newFilled >= match.spots_total ? 'full' : 'open';

  const { error } = await supabase.from('public_matches').update({
    player_ids: newPlayers,
    spots_filled: newFilled,
    status: newStatus,
  }).eq('id', matchId);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data: { joined: true, spots_filled: newFilled, status: newStatus } });
}
