/**
 * Court Lighting API (admin)
 *
 * GET  ?courtId=&date=  — list lighting schedules for a court/date
 * POST                  — create manual schedule { courtId, lightsOnAt, lightsOffAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/auth/guards';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const url = new URL(request.url);
  const courtId = url.searchParams.get('courtId');
  const date = url.searchParams.get('date'); // YYYY-MM-DD

  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('court_lighting_schedules')
    .select('*')
    .order('lights_on_at', { ascending: true });

  if (courtId) {
    query = query.eq('court_id', courtId);
  }

  if (date) {
    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59`;
    query = query.gte('lights_on_at', dayStart).lte('lights_on_at', dayEnd);
  }

  const { data, error } = await query.limit(100);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json();
  const { courtId, lightsOnAt, lightsOffAt } = body;

  if (!courtId || !lightsOnAt || !lightsOffAt) {
    return NextResponse.json({ success: false, error: 'courtId, lightsOnAt, and lightsOffAt are required' }, { status: 400 });
  }

  if (new Date(lightsOffAt) <= new Date(lightsOnAt)) {
    return NextResponse.json({ success: false, error: 'lightsOffAt must be after lightsOnAt' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Check that court exists and get hardware_relay_id
  const { data: court } = await supabase
    .from('courts')
    .select('id, hardware_relay_id')
    .eq('id', courtId)
    .maybeSingle();

  if (!court) {
    return NextResponse.json({ success: false, error: 'Court not found' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('court_lighting_schedules')
    .insert({
      court_id: courtId,
      lights_on_at: lightsOnAt,
      lights_off_at: lightsOffAt,
      hardware_relay_id: court.hardware_relay_id ?? null,
      status: 'scheduled',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
