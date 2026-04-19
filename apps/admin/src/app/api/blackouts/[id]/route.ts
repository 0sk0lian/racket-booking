import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../lib/auth/guards';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: blackout } = await supabase.from('blackout_periods').select('id, club_id').eq('id', id).single();
  if (!blackout) return NextResponse.json({ success: false, error: 'Blackout not found' }, { status: 404 });
  const access = await requireClubAccess(blackout.club_id);
  if (!access.ok) return access.response;

  const { error } = await supabase.from('blackout_periods').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
