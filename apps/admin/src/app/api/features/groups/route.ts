/**
 * GET  /api/features/groups?clubId=
 * POST /api/features/groups
 *
 * Returns player groups with master-category nesting for the group-aware player picker.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess, scopeClubIdsForAdmin } from '../../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const clubId = request.nextUrl.searchParams.get('clubId');
  if (clubId) {
    const access = await requireClubAccess(clubId);
    if (!access.ok) return access.response;
  }
  const scopedClubIds = clubId ? [clubId] : await scopeClubIdsForAdmin(admin);
  if (scopedClubIds !== null && scopedClubIds.length === 0) {
    return NextResponse.json({ success: true, data: [] });
  }

  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('groups')
    .select('*')
    .eq('is_active', true);
  if (scopedClubIds !== null) query = query.in('club_id', scopedClubIds);

  const { data: groups, error } = await query.order('name');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Enrich: resolve player + trainer names, compute child_groups for master categories
  const allPlayerIds = new Set<string>();
  const allTrainerIds = new Set<string>();
  (groups ?? []).forEach(g => {
    (g.player_ids ?? []).forEach((id: string) => allPlayerIds.add(id));
    (g.trainer_ids ?? []).forEach((id: string) => allTrainerIds.add(id));
  });

  const { data: players } = allPlayerIds.size > 0
    ? await supabase.from('users').select('id, full_name').in('id', Array.from(allPlayerIds))
    : { data: [] };
  const playerMap = new Map((players ?? []).map(p => [p.id, p]));

  const { data: trainers } = allTrainerIds.size > 0
    ? await supabase.from('users').select('id, full_name').in('id', Array.from(allTrainerIds))
    : { data: [] };
  const trainerMap = new Map((trainers ?? []).map(t => [t.id, t]));

  const enriched = (groups ?? []).map(g => {
    const isMaster = !g.parent_group_id && (groups ?? []).some(c => c.parent_group_id === g.id);
    const childGroups = isMaster
      ? (groups ?? []).filter(c => c.parent_group_id === g.id).map(c => ({
          id: c.id, name: c.name, player_count: (c.player_ids ?? []).length,
        }))
      : [];

    // For master categories, calculate total unique player_ids from the group itself + all children
    let totalMembers: number | undefined;
    if (isMaster) {
      const uniquePlayerIds = new Set<string>(g.player_ids ?? []);
      (groups ?? [])
        .filter(c => c.parent_group_id === g.id)
        .forEach(c => (c.player_ids ?? []).forEach((id: string) => uniquePlayerIds.add(id)));
      totalMembers = uniquePlayerIds.size;
    }

    return {
      ...g,
      is_master_category: isMaster,
      parent_group_name: g.parent_group_id
        ? (groups ?? []).find(p => p.id === g.parent_group_id)?.name ?? null
        : null,
      child_groups: childGroups,
      ...(totalMembers !== undefined ? { total_members: totalMembers } : {}),
      players: (g.player_ids ?? []).map((id: string) => playerMap.get(id) ?? { id, full_name: '?' }),
      trainers: (g.trainer_ids ?? []).map((id: string) => trainerMap.get(id) ?? { id, full_name: '?' }),
    };
  });

  return NextResponse.json({ success: true, data: enriched });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json();
  const { clubId, name } = body;
  if (!clubId || !name?.trim()) {
    return NextResponse.json({ success: false, error: 'clubId and name required' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('groups').insert({
    club_id: clubId,
    name: name.trim(),
    category: body.category ?? 'other',
    sport_type: body.sportType ?? 'padel',
    parent_group_id: body.parentGroupId ?? null,
    player_ids: body.playerIds ?? [],
    trainer_ids: body.trainerIds ?? [],
    max_size: body.maxSize ?? null,
    notes: body.notes ?? null,
  }).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
