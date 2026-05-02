import { createSupabaseAdminClient } from './supabase/server';
import { generateInvoicePdf } from './invoice-generator';
import { sendNotification } from './notifications';

type InvoiceLineItem = {
  description: string;
  amount: number;
};

type CreateInvoiceParams = {
  clubId: string;
  userId: string;
  description?: string | null;
  amount?: number | null;
  dueDate?: string | null;
  lineItems?: InvoiceLineItem[];
  membershipId?: string | null;
  courseRegistrationId?: string | null;
  notificationTitle?: string;
  notificationBody?: string;
};

function defaultDueDate() {
  return new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
}

export async function createInvoiceRecord(params: CreateInvoiceParams) {
  const supabase = createSupabaseAdminClient();

  const [{ data: club }, { data: user }] = await Promise.all([
    supabase
      .from('clubs')
      .select('name, organization_number, contact_email, contact_phone, city')
      .eq('id', params.clubId)
      .single(),
    supabase
      .from('users')
      .select('full_name, email')
      .eq('id', params.userId)
      .single(),
  ]);

  if (!club || !user) {
    throw new Error('Club or user not found');
  }

  let membershipType = '';
  let derivedMembershipPrice = 0;
  if (params.membershipId) {
    const { data: membership } = await supabase
      .from('club_memberships')
      .select('membership_type')
      .eq('id', params.membershipId)
      .single();
    membershipType = membership?.membership_type ?? '';

    if (membershipType) {
      const { data: typeData } = await supabase
        .from('membership_types')
        .select('price')
        .eq('club_id', params.clubId)
        .eq('name', membershipType)
        .eq('is_active', true)
        .maybeSingle();
      derivedMembershipPrice = Number(typeData?.price ?? 0);
    }
  }

  const invoiceAmount = Number(params.amount ?? derivedMembershipPrice ?? 0);
  const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
  const today = new Date().toISOString().split('T')[0];
  const dueDate = params.dueDate ?? defaultDueDate();
  const lineItems = params.lineItems?.length
    ? params.lineItems
    : [
        {
          description: params.description ?? `Medlemskap: ${membershipType || 'Standard'}`,
          amount: invoiceAmount,
        },
      ];

  const pdfBytes = await generateInvoicePdf({
    invoiceNumber,
    date: today,
    dueDate,
    clubName: club.name,
    clubOrgNumber: club.organization_number ?? undefined,
    clubEmail: club.contact_email ?? undefined,
    clubPhone: club.contact_phone ?? undefined,
    clubCity: club.city ?? undefined,
    memberName: user.full_name ?? 'Unknown',
    memberEmail: user.email ?? '',
    items: lineItems,
    total: invoiceAmount,
    currency: 'SEK',
  });

  const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
  const pdfUrl = `data:application/pdf;base64,${pdfBase64}`;

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      club_id: params.clubId,
      user_id: params.userId,
      membership_id: params.membershipId ?? null,
      invoice_number: invoiceNumber,
      amount: invoiceAmount,
      currency: 'SEK',
      description: lineItems[0]?.description ?? params.description ?? '',
      line_items: lineItems,
      status: 'sent',
      due_date: dueDate,
      pdf_url: pdfUrl,
    })
    .select()
    .single();

  if (error || !invoice) {
    throw new Error(error?.message ?? 'Could not create invoice');
  }

  if (params.membershipId) {
    await supabase
      .from('club_memberships')
      .update({ invoice_id: invoice.id, payment_status: 'unpaid' })
      .eq('id', params.membershipId);
  }

  if (params.courseRegistrationId) {
    await supabase
      .from('course_registrations')
      .update({ invoice_id: invoice.id, payment_status: 'unpaid', updated_at: new Date().toISOString() })
      .eq('id', params.courseRegistrationId);
  }

  await sendNotification({
    userId: params.userId,
    clubId: params.clubId,
    type: 'invoice.created',
    title: params.notificationTitle ?? 'Ny faktura',
    body:
      params.notificationBody ??
      `Faktura ${invoiceNumber} på ${invoiceAmount} SEK har skapats. Förfallodatum: ${dueDate}.`,
    entityType: 'invoice',
    entityId: invoice.id,
    sendEmail: true,
  });

  return invoice;
}
