/**
 * GET /api/admin/export?type=members|bookings|revenue&clubId=&from=&to=
 * CSV export for admin data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../lib/auth/guards';

/** Escape a value for CSV — quote if it contains comma, quote, or newline */
function csvEscape(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  return lines.join('\r\n');
}

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const type = p.get('type');
  const clubId = p.get('clubId');

  if (!type || !clubId) {
    return NextResponse.json({ success: false, error: 'type and clubId required' }, { status: 400 });
  }
  if (!['members', 'bookings', 'revenue'].includes(type)) {
    return NextResponse.json({ success: false, error: 'type must be members, bookings, or revenue' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const from = p.get('from') ?? new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
  const to = p.get('to') ?? now.toISOString().split('T')[0];

  let csv: string;
  let filename: string;

  if (type === 'members') {
    const { data: memberships, error } = await supabase
      .from('club_memberships')
      .select('id, user_id, membership_type, status, applied_at')
      .eq('club_id', clubId)
      .order('applied_at', { ascending: false });

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

    const userIds = [...new Set((memberships ?? []).map(m => m.user_id))];
    const { data: users } = userIds.length > 0
      ? await supabase.from('users').select('id, full_name, email, phone_number').in('id', userIds)
      : { data: [] };
    const userMap = new Map((users ?? []).map(u => [u.id, u]));

    const headers = ['id', 'full_name', 'email', 'phone_number', 'membership_type', 'status', 'applied_at'];
    const rows = (memberships ?? []).map(m => {
      const u = userMap.get(m.user_id);
      return [m.id, u?.full_name ?? '', u?.email ?? '', u?.phone_number ?? '', m.membership_type ?? '', m.status, m.applied_at];
    });

    csv = toCsv(headers, rows);
    filename = `members-${clubId}-${from}-${to}.csv`;
  } else if (type === 'bookings') {
    const { data: courts } = await supabase.from('courts').select('id, name').eq('club_id', clubId);
    const courtIds = (courts ?? []).map(c => c.id);
    const courtMap = new Map((courts ?? []).map(c => [c.id, c.name]));

    if (courtIds.length === 0) {
      csv = toCsv(['id', 'court_name', 'booker_name', 'booking_type', 'time_slot_start', 'time_slot_end', 'status', 'total_price'], []);
    } else {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('id, court_id, booker_id, booking_type, time_slot_start, time_slot_end, status, total_price')
        .in('court_id', courtIds)
        .gte('time_slot_start', from + 'T00:00:00')
        .lte('time_slot_start', to + 'T23:59:59')
        .order('time_slot_start', { ascending: false });

      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

      const bookerIds = [...new Set((bookings ?? []).map(b => b.booker_id).filter(Boolean))];
      const { data: bookers } = bookerIds.length > 0
        ? await supabase.from('users').select('id, full_name').in('id', bookerIds)
        : { data: [] };
      const bookerMap = new Map((bookers ?? []).map(u => [u.id, u.full_name]));

      const headers = ['id', 'court_name', 'booker_name', 'booking_type', 'time_slot_start', 'time_slot_end', 'status', 'total_price'];
      const rows = (bookings ?? []).map(b => [
        b.id,
        courtMap.get(b.court_id) ?? '',
        bookerMap.get(b.booker_id) ?? '',
        b.booking_type,
        b.time_slot_start,
        b.time_slot_end,
        b.status,
        b.total_price ?? 0,
      ]);

      csv = toCsv(headers, rows);
    }

    filename = `bookings-${clubId}-${from}-${to}.csv`;
  } else {
    // revenue — group by day
    const { data: courts } = await supabase.from('courts').select('id').eq('club_id', clubId);
    const courtIds = (courts ?? []).map(c => c.id);

    if (courtIds.length === 0) {
      csv = toCsv(['date', 'total_bookings', 'total_revenue'], []);
    } else {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('time_slot_start, total_price')
        .in('court_id', courtIds)
        .eq('status', 'confirmed')
        .gte('time_slot_start', from + 'T00:00:00')
        .lte('time_slot_start', to + 'T23:59:59');

      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

      const dayMap = new Map<string, { count: number; revenue: number }>();
      for (const b of bookings ?? []) {
        const day = b.time_slot_start?.split('T')[0] ?? '';
        const entry = dayMap.get(day) ?? { count: 0, revenue: 0 };
        entry.count += 1;
        entry.revenue += b.total_price ?? 0;
        dayMap.set(day, entry);
      }

      const rows = Array.from(dayMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => [date, v.count, v.revenue]);

      csv = toCsv(['date', 'total_bookings', 'total_revenue'], rows);
    }

    filename = `revenue-${clubId}-${from}-${to}.csv`;
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
