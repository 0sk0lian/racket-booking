/**
 * GET  /api/blackouts?clubId=  — list
 * POST /api/blackouts           — create
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';

export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get('clubId');
  const supabase = createSupabaseAdminClient();

  let query = supabase.from('blackout_periods').select('*');
  if (clubId) query = query.eq('club_id', clubId);
  query = query.order('starts_at');

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Enrich with court names
  const courtIds = new Set<string>();
  (data ?? []).forEach(bp => (bp.court_ids ?? []).forEach((id: string) => courtIds.add(id)));
  const { data: courts } = courtIds.size > 0
    ? await supabase.from('courts').select('id, name').in('id', Array.from(courtIds))
    : { data: [] };
  const courtMap = new Map((courts ?? []).map(c => [c.id, c.name]));

  const enriched = (data ?? []).map(bp => ({
    ...bp,
    court_names: (bp.court_ids ?? []).length > 0
      ? (bp.court_ids ?? []).map((id: string) => courtMap.get(id) ?? id)
      : ['All courts'],
  }));

  return NextResponse.json({ success: true, data: enriched });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.clubId || !body.startsAt || !body.endsAt) {
    return NextResponse.json({ success: false, error: 'clubId, startsAt, endsAt required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('blackout_periods').insert({
    club_id: body.clubId,
    starts_at: body.startsAt,
    ends_at: body.endsAt,
    reason: body.reason ?? null,
    court_ids: body.courtIds ?? [],
  }).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data });
}
