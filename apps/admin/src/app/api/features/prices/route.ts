/**
 * GET /api/features/prices?clubId=&date=YYYY-MM-DD
 * Price calendar: for each court and hour, returns the effective price.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../lib/auth/guards';

const HOUR_START = 7;
const HOUR_END = 22;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const clubId = request.nextUrl.searchParams.get('clubId');
  const dateStr = request.nextUrl.searchParams.get('date');

  if (!clubId) {
    return NextResponse.json({ success: false, error: 'clubId is required' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  // Default to today if no date given
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const dayOfWeek = new Date(date + 'T12:00:00Z').getDay(); // 0=Sun, 6=Sat

  const supabase = createSupabaseAdminClient();

  // Fetch active courts for the club
  const { data: courts, error: courtsError } = await supabase
    .from('courts')
    .select('id, name, base_hourly_rate, sport_type')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('name');

  if (courtsError) {
    return NextResponse.json({ success: false, error: courtsError.message }, { status: 500 });
  }

  if (!courts || courts.length === 0) {
    return NextResponse.json({ success: true, data: { days: [{ date, courts: [] }] } });
  }

  const courtIds = courts.map((c) => c.id);

  // Fetch price rules for these courts
  const { data: priceRules, error: rulesError } = await supabase
    .from('price_rules')
    .select('*')
    .in('court_id', courtIds)
    .eq('is_active', true);

  if (rulesError) {
    return NextResponse.json({ success: false, error: rulesError.message }, { status: 500 });
  }

  // Build per-court hourly price grid
  const courtData = courts.map((court) => {
    const courtRules = (priceRules ?? []).filter((r) => r.court_id === court.id);

    const hours = [];
    for (let hour = HOUR_START; hour < HOUR_END; hour++) {
      // Find a matching price rule for this hour and day
      const matchingRule = courtRules.find((rule) => {
        // Check day-of-week match
        const daysOfWeek: number[] | null = rule.days_of_week;
        if (daysOfWeek && !daysOfWeek.includes(dayOfWeek)) return false;

        // Check hour range
        const startHour = rule.start_hour ?? 0;
        const endHour = rule.end_hour ?? 24;
        if (hour < startHour || hour >= endHour) return false;

        // Check date range
        if (rule.valid_from && date < rule.valid_from) return false;
        if (rule.valid_until && date > rule.valid_until) return false;

        return true;
      });

      hours.push({
        hour,
        price: matchingRule ? matchingRule.price : (court.base_hourly_rate ?? 0),
        ruleId: matchingRule?.id ?? null,
      });
    }

    return {
      courtId: court.id,
      courtName: court.name,
      sportType: court.sport_type,
      baseRate: court.base_hourly_rate,
      hours,
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      days: [{ date, dayOfWeek, courts: courtData }],
    },
  });
}
