import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../../lib/auth/guards';
import { createInvoiceRecord } from '../../../../../lib/invoices';

function buildPassCountMap(sessions: Array<{ player_ids?: string[] | null }>) {
  const map = new Map<string, number>();
  for (const session of sessions) {
    for (const userId of session.player_ids ?? []) {
      map.set(userId, (map.get(userId) ?? 0) + 1);
    }
  }
  return map;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id: courseId } = await params;
  const body = await request.json().catch(() => ({}));
  const registrationIds = Array.isArray(body.registrationIds) ? (body.registrationIds as string[]) : [];

  if (registrationIds.length === 0) {
    return NextResponse.json({ success: false, error: 'registrationIds required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: course } = await supabase
    .from('courses')
    .select('id, club_id, name, price_total, price_per_session')
    .eq('id', courseId)
    .single();
  if (!course) return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });

  const access = await requireClubAccess(course.club_id);
  if (!access.ok) return access.response;

  const { data: registrations } = await supabase
    .from('course_registrations')
    .select('id, user_id, status, invoice_id')
    .eq('course_id', courseId)
    .in('id', registrationIds);

  const eligible = (registrations ?? []).filter((registration) => registration.status === 'approved' && !registration.invoice_id);
  if (eligible.length === 0) {
    return NextResponse.json({ success: false, error: 'No approved registrations without invoices were found' }, { status: 400 });
  }

  const sourceTag = `[course:${courseId}]`;
  const { data: plannerSessions } = await supabase
    .from('training_sessions')
    .select('player_ids')
    .eq('club_id', course.club_id)
    .ilike('notes', `%${sourceTag}%`);
  const passCountMap = buildPassCountMap((plannerSessions ?? []) as Array<{ player_ids?: string[] | null }>);

  const created: Array<{ registrationId: string; invoiceId: string }> = [];
  const skipped: Array<{ registrationId: string; reason: string }> = [];

  for (const registration of eligible) {
    const passCount = passCountMap.get(registration.user_id) ?? 0;
    const amount = course.price_per_session
      ? Number(course.price_per_session) * Math.max(passCount, 1)
      : Number(course.price_total ?? 0);

    if (!course.price_per_session && !course.price_total) {
      skipped.push({ registrationId: registration.id, reason: 'Course has no price configured' });
      continue;
    }

    const lineDescription = course.price_per_session
      ? `${course.name} - ${Math.max(passCount, 1)} pass`
      : course.name;

    try {
      const invoice = await createInvoiceRecord({
        clubId: course.club_id,
        userId: registration.user_id,
        courseRegistrationId: registration.id,
        description: lineDescription,
        amount,
        lineItems: [{ description: lineDescription, amount }],
        notificationTitle: 'Kursfaktura skapad',
        notificationBody: `En faktura för kursen "${course.name}" har skapats.`,
      });

      created.push({ registrationId: registration.id, invoiceId: invoice.id });
    } catch (error) {
      skipped.push({
        registrationId: registration.id,
        reason: error instanceof Error ? error.message : 'Could not create invoice',
      });
    }
  }

  return NextResponse.json({
    success: created.length > 0,
    data: {
      created,
      skipped,
    },
  });
}
