import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess, scopeClubIdsForAdmin } from '../../../../lib/auth/guards';

const ALLOWED_TYPES = new Set(['training', 'admin', 'event', 'other']);

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const clubId = request.nextUrl.searchParams.get('clubId');
  if (clubId) {
    const access = await requireClubAccess(clubId);
    if (!access.ok) return access.response;
  }

  const scopedClubIds = clubId ? [clubId] : await scopeClubIdsForAdmin(admin);
  if (scopedClubIds !== null && scopedClubIds.length === 0) {
    return NextResponse.json({ success: true, data: { reports: [], totalHours: 0 } });
  }

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('time_reports')
    .select('id, user_id, club_id, date, hours, type, description, approved, booking_id, created_at')
    .order('date', { ascending: false });
  if (scopedClubIds !== null) query = query.in('club_id', scopedClubIds);

  const { data: reports, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const userIds = [...new Set((reports ?? []).map((report) => report.user_id))];
  const { data: users } = userIds.length > 0
    ? await supabase.from('users').select('id, full_name').in('id', userIds)
    : { data: [] as any[] };
  const userMap = new Map((users ?? []).map((user) => [user.id, user.full_name]));

  const enriched = (reports ?? []).map((report) => ({
    ...report,
    user_name: userMap.get(report.user_id) ?? 'Unknown',
  }));
  const totalHours = enriched.reduce((sum, report) => sum + Number(report.hours ?? 0), 0);

  return NextResponse.json({
    success: true,
    data: {
      reports: enriched,
      totalHours: Number(totalHours.toFixed(2)),
    },
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json();
  const userId = body?.userId as string | undefined;
  const clubId = body?.clubId as string | undefined;
  const date = body?.date as string | undefined;
  const hours = Number(body?.hours ?? 0);
  const type = (body?.type as string | undefined) ?? 'training';
  const description = (body?.description as string | undefined) ?? null;
  const bookingId = (body?.bookingId as string | undefined) ?? null;

  if (!userId || !clubId || !date || !Number.isFinite(hours) || hours <= 0) {
    return NextResponse.json({ success: false, error: 'userId, clubId, date and positive hours are required' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ success: false, error: 'Invalid report type' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('time_reports')
    .insert({
      user_id: userId,
      club_id: clubId,
      date,
      hours,
      type,
      description,
      booking_id: bookingId,
      approved: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
