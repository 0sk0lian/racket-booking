import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../lib/auth/guards';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('recurrence_rules').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 404 });
  const access = await requireClubAccess(data.club_id);
  if (!access.ok) return access.response;
  return NextResponse.json({ success: true, data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await request.json();
  const supabase = createSupabaseAdminClient();
  const { data: rule } = await supabase.from('recurrence_rules').select('id, club_id').eq('id', id).single();
  if (!rule) return NextResponse.json({ success: false, error: 'Recurrence rule not found' }, { status: 404 });
  const access = await requireClubAccess(rule.club_id);
  if (!access.ok) return access.response;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (b.title !== undefined) updates.title = b.title;
  if (b.bookingType !== undefined) updates.booking_type = b.bookingType;
  if (b.courtId !== undefined) updates.court_id = b.courtId;
  if (b.startHour !== undefined) updates.start_hour = b.startHour;
  if (b.endHour !== undefined) updates.end_hour = b.endHour;
  if (b.freq !== undefined) updates.freq = b.freq;
  if (b.intervalN !== undefined) updates.interval_n = b.intervalN;
  if (b.weekdays !== undefined) updates.weekdays = b.weekdays;
  if (b.startDate !== undefined) updates.start_date = b.startDate;
  if (b.endDate !== undefined) updates.end_date = b.endDate;
  if (b.skipDates !== undefined) updates.skip_dates = b.skipDates;
  if (b.trainerId !== undefined) updates.trainer_id = b.trainerId;
  if (b.playerIds !== undefined) updates.player_ids = b.playerIds;
  if (b.isActive !== undefined) updates.is_active = b.isActive;
  const { data, error } = await supabase.from('recurrence_rules').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: rule } = await supabase.from('recurrence_rules').select('id, club_id').eq('id', id).single();
  if (!rule) return NextResponse.json({ success: false, error: 'Recurrence rule not found' }, { status: 404 });
  const access = await requireClubAccess(rule.club_id);
  if (!access.ok) return access.response;
  await supabase.from('recurrence_rules').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', id);
  return NextResponse.json({ success: true });
}
