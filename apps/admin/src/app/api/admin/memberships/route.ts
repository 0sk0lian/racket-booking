/**
 * GET    /api/admin/memberships?clubId=&status= — list memberships
 * PATCH  /api/admin/memberships                  — approve/reject
 * DELETE /api/admin/memberships?id=              — remove member from club
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess, scopeClubIdsForAdmin } from '../../../../lib/auth/guards';
import { onMembershipApproved } from '../../../../lib/cascades';
import { sendNotification } from '../../../../lib/notifications';
import { generateInvoicePdf } from '../../../../lib/invoice-generator';

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

  const supabase = createSupabaseAdminClient();

  // Fetch full membership data (need user_id, club_id, membership_type, form_answers)
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

  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === 'active' || status === 'approved') {
    updates.approved_at = new Date().toISOString();
    updates.approved_by = admin.user.id;
  }
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabase.from('club_memberships').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  // --- APPROVED: form reviewed, create invoice if price > 0 ---
  if (status === 'approved' && data) {
    // Apply form answers to user profile
    const formAnswers = (data.form_answers ?? {}) as Record<string, unknown>;
    if (Object.keys(formAnswers).length > 0) {
      const profileUpdates: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(formAnswers)) {
        const k = key.toLowerCase();
        if ((k === 'telefon' || k === 'phone' || k === 'phone_number' || k === 'parent_phone') && val) {
          profileUpdates.phone_number = String(val);
        }
        if ((k === 'personnummer' || k === 'social_number' || k === 'ssn') && val) {
          // Store personnummer in form_answers — no dedicated column, but searchable
        }
        if ((k === 'födelsedatum' || k === 'birth_date' || k === 'birthdate') && val) {
          if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
            profileUpdates.birth_date = val;
          }
        }
      }
      if (Object.keys(profileUpdates).length > 0) {
        await supabase.from('users').update(profileUpdates).eq('id', data.user_id);
      }
    }

    // Check membership type pricing
    const { data: typeData } = await supabase.from('membership_types')
      .select('price, interval')
      .eq('club_id', data.club_id)
      .eq('name', data.membership_type)
      .eq('is_active', true)
      .maybeSingle();

    const price = typeData?.price ?? 0;

    if (price > 0) {
      // Create invoice directly (no internal fetch)
      const { data: club } = await supabase.from('clubs')
        .select('name, organization_number, contact_email, contact_phone, city')
        .eq('id', data.club_id).single();
      const { data: user } = await supabase.from('users')
        .select('full_name, email')
        .eq('id', data.user_id).single();

      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
      const today = new Date().toISOString().split('T')[0];
      const due = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
      const items = [{ description: `Medlemskap: ${data.membership_type}`, amount: price }];

      // Generate PDF
      const pdfBytes = await generateInvoicePdf({
        invoiceNumber,
        date: today,
        dueDate: due,
        clubName: club?.name ?? '',
        clubOrgNumber: club?.organization_number ?? undefined,
        clubEmail: club?.contact_email ?? undefined,
        clubPhone: club?.contact_phone ?? undefined,
        clubCity: club?.city ?? undefined,
        memberName: user?.full_name ?? 'Unknown',
        memberEmail: user?.email ?? '',
        items,
        total: price,
        currency: 'SEK',
      });

      const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

      const { data: invoice } = await supabase.from('invoices').insert({
        club_id: data.club_id,
        user_id: data.user_id,
        membership_id: data.id,
        invoice_number: invoiceNumber,
        amount: price,
        currency: 'SEK',
        description: items[0].description,
        line_items: items,
        status: 'sent',
        due_date: due,
        pdf_url: `data:application/pdf;base64,${pdfBase64}`,
      }).select().single();

      // Link invoice to membership
      if (invoice) {
        await supabase.from('club_memberships').update({
          invoice_id: invoice.id,
          payment_status: 'unpaid',
        }).eq('id', data.id);
      }

      await sendNotification({
        userId: data.user_id,
        clubId: data.club_id,
        type: 'membership.approved',
        title: 'Ansökan godkänd — faktura skickad',
        body: `Din ansökan har godkänts! En faktura på ${price} SEK har skapats.`,
        entityType: 'membership',
        entityId: id,
        sendEmail: true,
      });

      return NextResponse.json({ success: true, data, invoice: invoice ?? null });

    } else if (typeData) {
      // Free membership type — activate directly
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

    } else {
      // No type found — stay approved, admin handles manually
      await sendNotification({
        userId: data.user_id, clubId: data.club_id,
        type: 'membership.approved',
        title: 'Ansökan godkänd',
        body: 'Din ansökan har godkänts av klubben.',
        entityType: 'membership', entityId: id, sendEmail: true,
      });

      return NextResponse.json({ success: true, data });
    }
  }

  // --- DIRECT ACTIVATION ---
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
