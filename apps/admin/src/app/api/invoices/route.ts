/**
 * GET  /api/invoices?clubId=&userId=&status=  — list invoices
 * POST /api/invoices                          — create invoice (auto or manual)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../lib/auth/guards';
import { generateInvoicePdf } from '../../../lib/invoice-generator';
import { sendNotification } from '../../../lib/notifications';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const clubId = request.nextUrl.searchParams.get('clubId');
  const userId = request.nextUrl.searchParams.get('userId');
  const status = request.nextUrl.searchParams.get('status');

  if (!clubId) return NextResponse.json({ success: false, error: 'clubId required' }, { status: 400 });
  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();
  let query = supabase.from('invoices').select('*').eq('club_id', clubId).order('created_at', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Enrich with user names
  const userIds = [...new Set((data ?? []).map(inv => inv.user_id))];
  const { data: users } = userIds.length > 0
    ? await supabase.from('users').select('id, full_name, email').in('id', userIds)
    : { data: [] };
  const userMap = new Map((users ?? []).map(u => [u.id, u]));

  const enriched = (data ?? []).map(inv => ({
    ...inv,
    user_name: userMap.get(inv.user_id)?.full_name ?? 'Unknown',
    user_email: userMap.get(inv.user_id)?.email ?? null,
  }));

  return NextResponse.json({ success: true, data: enriched });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json();
  const { clubId, userId, membershipId, description, amount, dueDate } = body;

  if (!clubId || !userId) {
    return NextResponse.json({ success: false, error: 'clubId and userId required' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();

  // Get club details for invoice
  const { data: club } = await supabase.from('clubs').select('name, organization_number, contact_email, contact_phone, city').eq('id', clubId).single();
  const { data: user } = await supabase.from('users').select('full_name, email').eq('id', userId).single();

  if (!club || !user) {
    return NextResponse.json({ success: false, error: 'Club or user not found' }, { status: 404 });
  }

  // Get membership details if linked
  let membershipType = '';
  let membershipPrice = 0;
  if (membershipId) {
    const { data: membership } = await supabase.from('club_memberships').select('membership_type').eq('id', membershipId).single();
    membershipType = membership?.membership_type ?? '';
    if (membershipType) {
      const { data: typeData } = await supabase.from('membership_types').select('price, interval').eq('club_id', clubId).eq('name', membershipType).eq('is_active', true).maybeSingle();
      membershipPrice = typeData?.price ?? 0;
    }
  }

  const invoiceAmount = amount ?? membershipPrice;
  const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
  const today = new Date().toISOString().split('T')[0];
  const due = dueDate ?? new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const items = [
    { description: description ?? `Medlemskap: ${membershipType || 'Standard'}`, amount: invoiceAmount },
  ];

  // Generate PDF
  const pdfBytes = await generateInvoicePdf({
    invoiceNumber,
    date: today,
    dueDate: due,
    clubName: club.name,
    clubOrgNumber: club.organization_number ?? undefined,
    clubEmail: club.contact_email ?? undefined,
    clubPhone: club.contact_phone ?? undefined,
    clubCity: club.city ?? undefined,
    memberName: user.full_name ?? 'Unknown',
    memberEmail: user.email ?? '',
    items,
    total: invoiceAmount,
    currency: 'SEK',
  });

  // Store as base64 data URI
  const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
  const pdfUrl = `data:application/pdf;base64,${pdfBase64}`;

  // Insert invoice
  const { data: invoice, error } = await supabase.from('invoices').insert({
    club_id: clubId,
    user_id: userId,
    membership_id: membershipId ?? null,
    invoice_number: invoiceNumber,
    amount: invoiceAmount,
    currency: 'SEK',
    description: items[0].description,
    line_items: items,
    status: 'sent',
    due_date: due,
    pdf_url: pdfUrl,
  }).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  // Link invoice to membership
  if (membershipId) {
    await supabase.from('club_memberships').update({ invoice_id: invoice.id, payment_status: 'unpaid' }).eq('id', membershipId);
  }

  // Notify the member
  await sendNotification({
    userId,
    clubId,
    type: 'invoice.created',
    title: 'Ny faktura',
    body: `Faktura ${invoiceNumber} på ${invoiceAmount} SEK har skapats. Förfallodatum: ${due}.`,
    entityType: 'invoice',
    entityId: invoice.id,
    sendEmail: true,
  });

  return NextResponse.json({ success: true, data: invoice }, { status: 201 });
}
