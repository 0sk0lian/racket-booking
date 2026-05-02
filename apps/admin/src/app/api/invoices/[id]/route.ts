/**
 * GET   /api/invoices/:id  - get invoice detail
 * PATCH /api/invoices/:id  - mark paid / cancel
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../lib/auth/guards';
import { onMembershipApproved } from '../../../../lib/cascades';
import { sendNotification } from '../../../../lib/notifications';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: invoice, error } = await supabase.from('invoices').select('*').eq('id', id).single();
  if (error || !invoice) {
    return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
  }

  const access = await requireClubAccess(invoice.club_id);
  if (!access.ok) return access.response;

  return NextResponse.json({ success: true, data: invoice });
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

    if (body.status === 'paid') {
      updates.paid_at = new Date().toISOString();
      updates.paid_method = body.paidMethod ?? 'manual';

      if (invoice.membership_id) {
        const { data: membership } = await supabase
          .from('club_memberships')
          .select('id, club_id, user_id, membership_type, status')
          .eq('id', invoice.membership_id)
          .single();

        if (membership && membership.status !== 'active') {
          await supabase
            .from('club_memberships')
            .update({
              status: 'active',
              payment_status: 'paid',
              approved_at: new Date().toISOString(),
              approved_by: admin.user.id,
            })
            .eq('id', membership.id);

          await onMembershipApproved({
            id: membership.id,
            club_id: membership.club_id,
            user_id: membership.user_id,
            membership_type: membership.membership_type,
            approved_by: admin.user.id,
          });

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

      const { data: courseRegistrations } = await supabase
        .from('course_registrations')
        .select('id, user_id, course_id')
        .eq('invoice_id', id);

      if ((courseRegistrations ?? []).length > 0) {
        await supabase
          .from('course_registrations')
          .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
          .eq('invoice_id', id);

        const courseIds = [...new Set((courseRegistrations ?? []).map((row) => row.course_id))];
        const { data: courses } = courseIds.length > 0
          ? await supabase.from('courses').select('id, club_id, name').in('id', courseIds)
          : { data: [] };
        const courseMap = new Map((courses ?? []).map((course) => [course.id, course]));

        for (const registration of courseRegistrations ?? []) {
          const course = courseMap.get(registration.course_id);
          await sendNotification({
            userId: registration.user_id,
            clubId: course?.club_id ?? invoice.club_id,
            type: 'course.invoice.paid',
            title: 'Kursbetalning registrerad',
            body: course
              ? `Din betalning för kursen "${course.name}" har registrerats.`
              : 'Din kursbetalning har registrerats.',
            entityType: 'invoice',
            entityId: id,
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
