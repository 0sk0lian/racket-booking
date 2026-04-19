/**
 * GET  /api/membership-types?clubId=       — list types for a club (public)
 * POST /api/membership-types               — create a type (admin)
 * PATCH /api/membership-types              — update a type (admin)
 * DELETE /api/membership-types?id=         — deactivate a type (admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get('clubId');
  if (!clubId) {
    return NextResponse.json({ success: false, error: 'clubId required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('membership_types')
    .select('*')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('sort_order')
    .order('name');

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json();
  const { clubId, name, description, price, currency, interval } = body;

  if (!clubId || !name?.trim()) {
    return NextResponse.json({ success: false, error: 'clubId and name required' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const validIntervals = ['month', 'quarter', 'half_year', 'year', 'once'];
  if (interval && !validIntervals.includes(interval)) {
    return NextResponse.json({ success: false, error: `interval must be one of: ${validIntervals.join(', ')}` }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('membership_types').insert({
    club_id: clubId,
    name: name.trim(),
    description: description ?? null,
    price: price ?? 0,
    currency: currency ?? 'SEK',
    interval: interval ?? 'month',
  }).select().single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ success: false, error: 'A membership type with that name already exists' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json();
  const { id, name, description, price, currency, interval, isActive, sortOrder } = body;

  if (!id) {
    return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Verify the type exists and check club access
  const { data: existing } = await supabase.from('membership_types').select('club_id').eq('id', id).single();
  if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const access = await requireClubAccess(existing.club_id);
  if (!access.ok) return access.response;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = price;
  if (currency !== undefined) updates.currency = currency;
  if (interval !== undefined) updates.interval = interval;
  if (isActive !== undefined) updates.is_active = isActive;
  if (sortOrder !== undefined) updates.sort_order = sortOrder;

  const { data, error } = await supabase.from('membership_types').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

  const supabase = createSupabaseAdminClient();

  const { data: existing } = await supabase.from('membership_types').select('club_id').eq('id', id).single();
  if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const access = await requireClubAccess(existing.club_id);
  if (!access.ok) return access.response;

  // Soft-delete: deactivate instead of deleting (existing memberships reference the name)
  const { error } = await supabase.from('membership_types').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  return NextResponse.json({ success: true });
}
