/**
 * POST /api/admin/digest — generate and send weekly digest email for a club
 *
 * Body: { clubId }
 * Requires admin access to the club.
 * Collects: bookings this week, revenue, new members, pending memberships.
 * Sends digest via the notification system (sendEmail=true).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../lib/auth/guards';
import { sendNotification } from '../../../../lib/notifications';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { clubId } = body;
  if (!clubId) return NextResponse.json({ success: false, error: 'clubId required' }, { status: 400 });

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();

  // Fetch club name
  const { data: club } = await supabase.from('clubs').select('name').eq('id', clubId).single();
  const clubName = club?.name ?? 'Din anlaggning';

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const weekAgoIso = weekAgo.toISOString();

  // Get courts for this club
  const { data: courts } = await supabase.from('courts').select('id').eq('club_id', clubId).eq('is_active', true);
  const courtIds = (courts ?? []).map(c => c.id);

  // Bookings this week
  let bookingCount = 0;
  let revenue = 0;
  if (courtIds.length > 0) {
    const { data: weekBookings } = await supabase
      .from('bookings')
      .select('id, total_price')
      .in('court_id', courtIds)
      .neq('status', 'cancelled')
      .gte('time_slot_start', weekAgoIso);
    bookingCount = (weekBookings ?? []).length;
    revenue = (weekBookings ?? []).reduce((sum, b) => sum + (b.total_price ?? 0), 0);
  }

  // New members this week
  const { data: newMembers } = await supabase
    .from('club_memberships')
    .select('id')
    .eq('club_id', clubId)
    .eq('status', 'active')
    .gte('approved_at', weekAgoIso);
  const newMemberCount = (newMembers ?? []).length;

  // Pending membership applications
  const { data: pendingMembers } = await supabase
    .from('club_memberships')
    .select('id')
    .eq('club_id', clubId)
    .eq('status', 'pending');
  const pendingCount = (pendingMembers ?? []).length;

  // Build digest content
  const digestBody = [
    `Denna vecka:`,
    `- ${bookingCount} bokningar`,
    `- ${revenue.toLocaleString('sv-SE')} kr i intakter`,
    `- ${newMemberCount} nya medlemmar`,
    `- ${pendingCount} vantande ansokningar`,
    ``,
    `Se detaljer: https://racket-booking-admin.vercel.app/dashboard`,
  ].join('\n');

  const subject = `Veckosammanfattning \u2014 ${clubName}`;

  // Send notification to the admin who triggered it
  await sendNotification({
    userId: access.user.id,
    clubId,
    type: 'digest.weekly',
    title: subject,
    body: digestBody,
    sendEmail: true,
  });

  return NextResponse.json({
    success: true,
    data: {
      subject,
      body: digestBody,
      stats: {
        bookings: bookingCount,
        revenue,
        new_members: newMemberCount,
        pending_memberships: pendingCount,
      },
    },
  });
}
