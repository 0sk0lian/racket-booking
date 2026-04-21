/**
 * GET   /api/invoices/:id          — get invoice detail (+ PDF)
 * PATCH /api/invoices/:id          — mark paid / cancel
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../lib/auth/guards';
import { onMembershipApproved } from '../../../../lib/cascades';
import { sendNotification } from '../../../../lib/notifications';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single();
  if (error || !data) return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
  return NextResponse.json({ success: true, data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const body = await request.json();
  const supabase = createSupabaseAdminClient();

  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', id).single();
  if (!invoice) return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });

  const access = await requireClubAccess(invoice.club_id);
  if (!access.ok) return access.response;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.status) {
    updates.status = body.status;

    // Mark paid → activate membership
    if (body.status === 'paid') {
      updates.paid_at = new Date().toISOString();
      updates.paid_method = body.paidMethod ?? 'manual';

      // Auto-activate the linked membership
      if (invoice.membership_id) {
        const { data: membership } = await supabase
          .from('club_memberships')
          .select('id, club_id, user_id, membership_type, status')
          .eq('id', invoice.membership_id)
          .single();

        if (membership && membership.status !== 'active') {
          await supabase.from('club_memberships').update({
            status: 'active',
            payment_status: 'paid',
            approved_at: new Date().toISOString(),
            approved_by: admin.user.id,
          }).eq('id', membership.id);

          // Run the membership approval cascade (expiry, group assignment)
          await onMembershipApproved({
            id: membership.id,
            club_id: membership.club_id,
            user_id: membership.user_id,
            membership_type: membership.membership_type,
            approved_by: admin.user.id,
          });

          // Notify member
          await sendNotification({
            userId: membership.user_id,
            clubId: membership.club_id,
            type: 'membership.activated',
            title: 'Medlemskap aktiverat',
            body: 'Din betalning har registrerats och ditt medlemskap är nu aktivt. Välkommen!',
            entityType: 'membership',
            entityId: membership.id,
            sendEmail: true,
          });
        }
      }
    }
  }

  const { data, error } = await supabase.from('invoices').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data });
}
