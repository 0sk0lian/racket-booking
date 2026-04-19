/**
 * GET /api/users/me/data-export
 * GDPR data export — returns all user data as JSON download.
 */
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireUser } from '../../../../../lib/auth/guards';

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const userId = auth.user.id;
  const supabase = createSupabaseAdminClient();

  // Collect all user data in parallel
  const [
    profileResult,
    bookingsResult,
    membershipsResult,
    attendanceResult,
    courseRegistrationsResult,
    formSubmissionsResult,
  ] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('bookings').select('*').eq('booker_id', userId).order('created_at', { ascending: false }),
    supabase.from('club_memberships').select('*').eq('user_id', userId).order('applied_at', { ascending: false }),
    supabase.from('attendance').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('course_registrations').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('form_submissions').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    profile: profileResult.data ?? null,
    bookings: bookingsResult.data ?? [],
    memberships: membershipsResult.data ?? [],
    attendance: attendanceResult.data ?? [],
    course_registrations: courseRegistrationsResult.data ?? [],
    form_submissions: formSubmissionsResult.data ?? [],
  };

  const json = JSON.stringify(exportData, null, 2);

  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="my-data.json"',
    },
  });
}
