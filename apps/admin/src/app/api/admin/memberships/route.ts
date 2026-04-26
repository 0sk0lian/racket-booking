/**
 * GET    /api/admin/memberships?clubId=&status= — list memberships
 * PATCH  /api/admin/memberships                  — approve/reject/suspend
 * DELETE /api/admin/memberships?id=              — remove member from club
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess, scopeClubIdsForAdmin } from '../../../../lib/auth/guards';
import { onMembershipApproved } from '../../../../lib/cascades';
import { sendNotification } from '../../../../lib/notifications';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const clubId = request.nextUrl.searchParams.get('clubId');
  const status = request.nextUrl.searchParams.get('status');
  const supabase = createSupabaseAdminClient();

  let scopedClubIds: string[] | null = null;
  if (clubId) {
    const access = await requireClubAccess(clubId);
    if (!access.ok) return access.response;
  } else {
    scopedClubIds = await scopeClubIdsForAdmin(admin);
  }

  let query = supabase.from('club_memberships').select('*');
  if (clubId) {
    query = query.eq('club_id', clubId);
  } else if (scopedClubIds !== null) {
    if (scopedClubIds.length === 0) return NextResponse.json({ success: true, data: [] });
    query = query.in('club_id', scopedClubIds);
  }
  if (status) query = query.eq('status', status);
  query = query.order('applied_at', { ascending: false });

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const userIds = [...new Set((data ?? []).map((m) => m.user_id))];
  const { data: users } = userIds.length > 0
    ? await supabase.from('users').select('id, full_name, email').in('id', userIds)
    : { data: [] };
  const userMap = new Map((users ?? []).map((u) => [u.id, u]));

  const enriched = (data ?? []).map((m) => ({
    ...m,
    user_name: userMap.get(m.user_id)?.full_name ?? 'Unknown',
    user_email: userMap.get(m.user_id)?.email ?? null,
  }));

  return NextResponse.json({ success: true, data: enriched });
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id, status, notes } = await request.json();
  if (!id || !status) {
    return NextResponse.json({ success: false, error: 'id and status required' }, { status: 400 });
  }

  const validStatuses = ['pending', 'approved', 'active', 'suspended', 'cancelled', 'rejected'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: membership } = await supabase
    .from('club_memberships')
    .select('*')
    .eq('id', id)
    .single();
  if (!membership) {
    return NextResponse.json({ success: false, error: 'Membership not found' }, { status: 404 });
  }

  const access = await requireClubAccess(membership.club_id);
  if (!access.ok) return access.response;

  // 'approved' from UI means "godkänn" → set directly to 'active'
  const effectiveStatus = status === 'approved' ? 'active' : status;

  const updates: Record<string, unknown> = { status: effectiveStatus, updated_at: new Date().toISOString() };
  if (effectiveStatus === 'active') {
    updates.approved_at = new Date().toISOString();
    updates.approved_by = admin.user.id;
  }
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabase.from('club_memberships').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  // --- GODKÄNN (approved → active) ---
  if (status === 'approved' && data) {
    // Apply form answers to user profile
    const fa = (data.form_answers ?? {}) as Record<string, unknown>;
    if (Object.keys(fa).length > 0) {
      const profileUpdates: Record<string, unknown> = {};
      if (fa.telefon) profileUpdates.phone_number = String(fa.telefon);
      if (fa.fornamn || fa.efternamn) {
        const fn = String(fa.fornamn ?? '').trim();
        const ln = String(fa.efternamn ?? '').trim();
        if (fn || ln) profileUpdates.full_name = `${fn} ${ln}`.trim();
      }
      if (Object.keys(profileUpdates).length > 0) {
        await supabase.from('users').update(profileUpdates).eq('id', data.user_id);
      }
    }

    await onMembershipApproved({
      id: data.id, club_id: data.club_id, user_id: data.user_id,
      membership_type: data.membership_type, approved_by: admin.user.id,
    });

    await sendNotification({
      userId: data.user_id, clubId: data.club_id,
      type: 'membership.approved',
      title: 'Medlemskap godkänt',
      body: 'Din ansökan har godkänts. Välkommen till klubben!',
      entityType: 'membership', entityId: id, sendEmail: true,
    });

    return NextResponse.json({ success: true, data });
  }

  // --- AVSLÅ (rejected) ---
  if (status === 'rejected' && data) {
    await sendNotification({
      userId: data.user_id, clubId: data.club_id,
      type: 'membership.rejected',
      title: 'Ansökan avslagen',
      body: 'Din medlemsansökan har tyvärr avslagits. Kontakta klubben för mer information.',
      entityType: 'membership', entityId: id, sendEmail: true,
    });

    return NextResponse.json({ success: true, data });
  }

  // --- DIRECT ACTIVATION (admin sets active manually) ---
  if (status === 'active' && data) {
    await onMembershipApproved({
      id: data.id, club_id: data.club_id, user_id: data.user_id,
      membership_type: data.membership_type, approved_by: admin.user.id,
    });

    await sendNotification({
      userId: data.user_id, clubId: data.club_id,
      type: 'membership.approved',
      title: 'Medlemskap aktiverat',
      body: 'Ditt medlemskap är nu aktivt. Välkommen!',
      entityType: 'membership', entityId: id, sendEmail: true,
    });
  }

  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id required' }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: membership } = await supabase.from('club_memberships').select('club_id').eq('id', id).single();
  if (!membership) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

  const access = await requireClubAccess(membership.club_id);
  if (!access.ok) return access.response;

  const { error } = await supabase.from('club_memberships').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
