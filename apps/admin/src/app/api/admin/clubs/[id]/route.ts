/**
 * PATCH /api/admin/clubs/:id — Update club settings
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../../lib/auth/guards';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;

  const access = await requireClubAccess(id);
  if (!access.ok) return access.response;

  const body = await request.json();
  const supabase = createSupabaseAdminClient();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.isNonProfit !== undefined) updates.is_non_profit = body.isNonProfit;
  if (body.contactEmail !== undefined) updates.contact_email = body.contactEmail;
  if (body.contactPhone !== undefined) updates.contact_phone = body.contactPhone;
  if (body.address !== undefined) updates.address = body.address;
  if (body.city !== undefined) updates.city = body.city;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('clubs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
