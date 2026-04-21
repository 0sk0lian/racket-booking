import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../../lib/auth/guards';
import { onPlayerRemovedFromGroup } from '../../../../../lib/cascades';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: group } = await supabase.from('groups').select('club_id, player_ids').eq('id', id).single();
  if (!group) return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });

  const access = await requireClubAccess(group.club_id);
  if (!access.ok) return access.response;

  const body = await request.json();
  const camelToSnake: Record<string, string> = {
    sportType: 'sport_type',
    playerIds: 'player_ids',
    trainerIds: 'trainer_ids',
    maxSize: 'max_size',
    parentGroupId: 'parent_group_id',
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  // Direct fields
  for (const key of ['name', 'category', 'notes']) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  // camelCase fields
  for (const [camel, snake] of Object.entries(camelToSnake)) {
    if (body[camel] !== undefined) updates[snake] = body[camel];
  }

  // Detect removed players before the update
  const removedPlayerIds: string[] = [];
  if (body.playerIds !== undefined) {
    const existingPlayerIds: string[] = group.player_ids ?? [];
    const newPlayerIds: string[] = body.playerIds;
    removedPlayerIds.push(...existingPlayerIds.filter(pid => !newPlayerIds.includes(pid)));
  }

  const { data, error } = await supabase.from('groups').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  // Cascade: remove players from linked training sessions
  for (const userId of removedPlayerIds) {
    onPlayerRemovedFromGroup({ userId, groupId: id, clubId: group.club_id }).catch(() => {});
  }

  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: group } = await supabase.from('groups').select('club_id').eq('id', id).single();
  if (!group) return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404 });

  const access = await requireClubAccess(group.club_id);
  if (!access.ok) return access.response;

  await supabase.from('groups').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
  return NextResponse.json({ success: true });
}
