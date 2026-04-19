/**
 * GET /api/admin/activity?clubId=&limit=50&entityType=&entityId=
 * Returns activity log entries enriched with actor name.
 * Requires admin + club access.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const clubId = searchParams.get('clubId');
  if (!clubId) {
    return NextResponse.json({ success: false, error: 'clubId required' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  // Parse & clamp limit
  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 50 : rawLimit), 200);

  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');

  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('activity_log')
    .select('id, club_id, actor_id, action, entity_type, entity_id, metadata, created_at')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (entityType) {
    query = query.eq('entity_type', entityType);
  }
  if (entityId) {
    query = query.eq('entity_id', entityId);
  }

  const { data: entries, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Enrich with actor names
  const actorIds = [...new Set((entries ?? []).map((e) => e.actor_id).filter(Boolean))];
  const { data: actors } = actorIds.length > 0
    ? await supabase.from('users').select('id, full_name').in('id', actorIds)
    : { data: [] };

  const actorMap = new Map((actors ?? []).map((u) => [u.id, u.full_name]));

  const enriched = (entries ?? []).map((e) => ({
    ...e,
    actor_name: actorMap.get(e.actor_id) ?? null,
  }));

  return NextResponse.json({ success: true, data: enriched });
}
