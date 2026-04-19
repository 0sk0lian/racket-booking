import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireClubAccess, requireSuperadmin } from '../../../../lib/auth/guards';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clubAccess = await requireClubAccess(id);
  if (!clubAccess.ok) return clubAccess.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('clubs').select('*').eq('id', id).single();
  if (error || !data) return NextResponse.json({ success: false, error: 'Club not found' }, { status: 404 });
  return NextResponse.json({ success: true, data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const superadmin = await requireSuperadmin();
  if (!superadmin.ok) return superadmin.response;

  const { id } = await params;
  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) updates.name = body.name;
  if (body.organizationNumber !== undefined) updates.organization_number = body.organizationNumber;
  if (body.city !== undefined) updates.city = body.city;
  if (body.timezone !== undefined) updates.timezone = body.timezone;
  if (body.isNonProfit !== undefined) updates.is_non_profit = body.isNonProfit;
  if (body.contactEmail !== undefined) updates.contact_email = body.contactEmail;
  if (body.contactPhone !== undefined) updates.contact_phone = body.contactPhone;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('clubs').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const superadmin = await requireSuperadmin();
  if (!superadmin.ok) return superadmin.response;

  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('clubs').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
