/**
 * GET   /api/admin/memberships?clubId=&status= — list memberships
 * PATCH /api/admin/memberships                  — approve/reject (body: { id, status, notes? })
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

  const userIds = [...new Set((data ?? []).map((membership) => membership.user_id))];
  const { data: users } = userIds.length > 0
    ? await supabase.from('users').select('id, full_name, email').in('id', userIds)
    : { data: [] };
  const userMap = new Map((users ?? []).map((user) => [user.id, user]));

  const enriched = (data ?? []).map((membership) => ({
    ...membership,
    user_name: userMap.get(membership.user_id)?.full_name ?? 'Unknown',
    user_email: userMap.get(membership.user_id)?.email ?? null,
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

  const supabase = createSupabaseAdminClient();
  const { data: membership } = await supabase.from('club_memberships').select('id, club_id').eq('id', id).single();
  if (!membership) {
    return NextResponse.json({ success: false, error: 'Membership not found' }, { status: 404 });
  }

  const access = await requireClubAccess(membership.club_id);
  if (!access.ok) return access.response;

  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'active' || status === 'approved') {
    updates.approved_at = new Date().toISOString();
    updates.approved_by = admin.user.id;
  }
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabase.from('club_memberships').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  // When form is approved: create an invoice and wait for payment
  // status='approved' = form reviewed OK, invoice sent, waiting for payment
  // status='active' = paid and activated (can also be set directly for free memberships)
  if (status === 'approved' && data) {
    // Check if membership type has a price > 0
    const { data: typeData } = await supabase.from('membership_types')
      .select('price, interval')
      .eq('club_id', data.club_id)
      .eq('name', data.membership_type)
      .eq('is_active', true)
      .maybeSingle();

    const price = typeData?.price ?? 0;

    if (price > 0) {
      // Create invoice — membership stays "approved" until paid
      const invoiceRes = await fetch(new URL('/api/invoices', request.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: request.headers.get('cookie') ?? '' },
        body: JSON.stringify({
          clubId: data.club_id,
          userId: data.user_id,
          membershipId: data.id,
          amount: price,
        }),
      }).then(r => r.json());

      await sendNotification({
        userId: data.user_id,
        clubId: data.club_id,
        type: 'membership.approved',
        title: 'Ansökan godkänd — faktura skickad',
        body: `Din ansökan har godkänts! En faktura på ${price} SEK har skapats. Medlemskapet aktiveras när betalningen registreras.`,
        entityType: 'membership',
        entityId: id,
        sendEmail: true,
      });

      return NextResponse.json({ success: true, data, invoice: invoiceRes.data ?? null });
    } else {
      // Free membership — activate directly
      await supabase.from('club_memberships').update({
        status: 'active',
        payment_status: 'free',
      }).eq('id', data.id);

      await onMembershipApproved({
        id: data.id, club_id: data.club_id, user_id: data.user_id,
        membership_type: data.membership_type, approved_by: admin.user.id,
      });

      await sendNotification({
        userId: data.user_id, clubId: data.club_id,
        type: 'membership.approved',
        title: 'Medlemskap godkänt',
        body: 'Ditt medlemskap har godkänts. Välkommen!',
        entityType: 'membership', entityId: id, sendEmail: true,
      });

      return NextResponse.json({ success: true, data: { ...data, status: 'active', payment_status: 'free' } });
    }
  }

  // Direct activation (e.g., admin manually sets active)
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
