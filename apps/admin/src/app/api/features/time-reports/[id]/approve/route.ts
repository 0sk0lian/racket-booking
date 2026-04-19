import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../../../lib/auth/guards';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: report } = await supabase.from('time_reports').select('id, club_id').eq('id', id).single();
  if (!report) return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });

  const access = await requireClubAccess(report.club_id);
  if (!access.ok) return access.response;

  const { data, error } = await supabase
    .from('time_reports')
    .update({ approved: true })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data });
}
