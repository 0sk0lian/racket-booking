import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { getManagedClubIds, getRequestUser, getUserRole, requireAdmin, requireClubAccess } from '../../../../lib/auth/guards';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('courses').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });

  const user = await getRequestUser();
  if (user) {
    const role = await getUserRole(user.id);
    if (role === 'admin') {
      const managedClubIds = await getManagedClubIds(user.id);
      if (!managedClubIds.includes(data.club_id)) {
        return NextResponse.json({ success: false, error: 'You do not have access to this venue' }, { status: 403 });
      }
    }
  }

  const { data: court } = await supabase.from('courts').select('name').eq('id', data.court_id).single();
  const { data: trainer } = data.trainer_id ? await supabase.from('users').select('full_name').eq('id', data.trainer_id).single() : { data: null };

  return NextResponse.json({ success: true, data: { ...data, court_name: court?.name, trainer_name: trainer?.full_name } });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const b = await request.json();
  const supabase = createSupabaseAdminClient();
  const { data: course } = await supabase.from('courses').select('id, club_id').eq('id', id).single();
  if (!course) return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
  const access = await requireClubAccess(course.club_id);
  if (!access.ok) return access.response;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const fields = ['name', 'description', 'court_id', 'trainer_id', 'day_of_week', 'start_hour', 'end_hour', 'term_start', 'term_end', 'skip_dates', 'max_participants', 'price_total', 'price_per_session', 'registration_status', 'visibility', 'status', 'sport_type', 'category', 'registration_form_id'];
  const camelToSnake: Record<string, string> = { courtId: 'court_id', trainerId: 'trainer_id', dayOfWeek: 'day_of_week', startHour: 'start_hour', endHour: 'end_hour', termStart: 'term_start', termEnd: 'term_end', skipDates: 'skip_dates', maxParticipants: 'max_participants', priceTotal: 'price_total', pricePerSession: 'price_per_session', registrationStatus: 'registration_status', sportType: 'sport_type', registrationFormId: 'registration_form_id' };

  for (const [key, val] of Object.entries(b)) {
    const snakeKey = camelToSnake[key] ?? key;
    if (fields.includes(snakeKey) && val !== undefined) updates[snakeKey] = val;
  }

  const { data, error } = await supabase.from('courses').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: course } = await supabase.from('courses').select('id, club_id').eq('id', id).single();
  if (!course) return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
  const access = await requireClubAccess(course.club_id);
  if (!access.ok) return access.response;
  await supabase.from('courses').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id);
  return NextResponse.json({ success: true });
}
