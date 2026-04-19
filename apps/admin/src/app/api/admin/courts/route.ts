/**
 * POST /api/admin/courts — Create a new court
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../lib/auth/guards';

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json();
  const { clubId, name, sportType, isIndoor, baseHourlyRate, hardwareRelayId } = body;

  if (!clubId || !name) {
    return NextResponse.json(
      { success: false, error: 'clubId and name are required' },
      { status: 400 },
    );
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();

  const insert: Record<string, unknown> = {
    club_id: clubId,
    name,
    sport_type: sportType ?? 'padel',
    is_indoor: isIndoor ?? false,
    base_hourly_rate: baseHourlyRate ?? 0,
    is_active: true,
  };
  if (hardwareRelayId !== undefined) insert.hardware_relay_id = hardwareRelayId;

  const { data, error } = await supabase
    .from('courts')
    .insert(insert)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}
