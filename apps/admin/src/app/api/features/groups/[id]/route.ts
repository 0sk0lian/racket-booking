import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../../lib/auth/guards';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: group } = await supabase.from('groups').select('club_id').eq('id', id).single();
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

  const { data, error } = await supabase.from('groups').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
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
