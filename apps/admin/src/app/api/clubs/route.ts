import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';
import { getRequestUser, getUserRole, getManagedClubIds, requireSuperadmin } from '../../../lib/auth/guards';

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const requestUser = await getRequestUser();

  let managedClubIds: string[] | null = null;
  if (requestUser) {
    const role = await getUserRole(requestUser.id);
    if (role === 'admin') {
      managedClubIds = await getManagedClubIds(requestUser.id);
    }
  }

  let query = supabase.from('clubs').select('*').order('name');
  if (managedClubIds !== null) {
    if (managedClubIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }
    query = query.in('id', managedClubIds);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const superadmin = await requireSuperadmin();
  if (!superadmin.ok) return superadmin.response;

  const body = await request.json();
  if (!body?.name) {
    return NextResponse.json({ success: false, error: 'name required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('clubs').insert({
    name: body.name,
    organization_number: body.organizationNumber ?? null,
    city: body.city ?? null,
    timezone: body.timezone ?? 'Europe/Stockholm',
    is_non_profit: body.isNonProfit ?? false,
    contact_email: body.contactEmail ?? null,
    contact_phone: body.contactPhone ?? null,
  }).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
