/**
 * PATCH  /api/admin/courts/:id — Update court fields
 * DELETE /api/admin/courts/:id — Soft-delete (deactivate) a court
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../../lib/auth/guards';
import { onCourtDeactivated } from '../../../../../lib/cascades';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const body = await request.json();
  const supabase = createSupabaseAdminClient();

  // Look up the court to verify it exists and get club_id for access check
  const { data: court } = await supabase
    .from('courts')
    .select('id, club_id')
    .eq('id', id)
    .single();

  if (!court) {
    return NextResponse.json({ success: false, error: 'Court not found' }, { status: 404 });
  }

  const access = await requireClubAccess(court.club_id);
  if (!access.ok) return access.response;

  const updates: Record<string, unknown> = {};
  if (body.isActive !== undefined) updates.is_active = body.isActive;
  if (body.baseHourlyRate !== undefined) updates.base_hourly_rate = body.baseHourlyRate;
  if (body.name !== undefined) updates.name = body.name;
  if (body.sportType !== undefined) updates.sport_type = body.sportType;
  if (body.isIndoor !== undefined) updates.is_indoor = body.isIndoor;
  if (body.hardwareRelayId !== undefined) updates.hardware_relay_id = body.hardwareRelayId;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('courts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Cascade: cancel future bookings when a court is deactivated
  if (body.isActive === false) {
    const cancelledCount = await onCourtDeactivated(id);
    return NextResponse.json({ success: true, data, cancelledBookings: cancelledCount });
  }

  return NextResponse.json({ success: true, data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: court } = await supabase
    .from('courts')
    .select('id, club_id')
    .eq('id', id)
    .single();

  if (!court) {
    return NextResponse.json({ success: false, error: 'Court not found' }, { status: 404 });
  }

  const access = await requireClubAccess(court.club_id);
  if (!access.ok) return access.response;

  const { error } = await supabase
    .from('courts')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
