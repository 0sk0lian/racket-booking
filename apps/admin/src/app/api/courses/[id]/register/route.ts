/**
 * POST /api/courses/:id/register — player registers for a course
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../../lib/supabase/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });

  const supabase = createSupabaseAdminClient();

  // Fetch course
  const { data: course } = await supabase.from('courses').select('*').eq('id', courseId).single();
  if (!course) return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
  if (course.registration_status === 'closed' || course.registration_status === 'draft') {
    return NextResponse.json({ success: false, error: 'Registration is not open' }, { status: 400 });
  }

  // Check not already registered
  const { data: existing } = await supabase.from('course_registrations')
    .select('status').eq('course_id', courseId).eq('user_id', user.id).single();
  if (existing && existing.status !== 'cancelled' && existing.status !== 'rejected') {
    return NextResponse.json({ success: false, error: 'Already registered' }, { status: 400 });
  }

  // Determine status: if capacity full → waitlisted
  const { data: approved } = await supabase.from('course_registrations')
    .select('id').eq('course_id', courseId).eq('status', 'approved');
  const approvedCount = approved?.length ?? 0;
  const isFull = course.max_participants && approvedCount >= course.max_participants;

  let status = 'pending';
  let waitlistPos = null;
  if (isFull || course.registration_status === 'waitlist') {
    status = 'waitlisted';
    const { data: maxPos } = await supabase.from('course_registrations')
      .select('waitlist_position').eq('course_id', courseId).eq('status', 'waitlisted')
      .order('waitlist_position', { ascending: false }).limit(1);
    waitlistPos = ((maxPos?.[0]?.waitlist_position as number) ?? 0) + 1;
  }

  const { data, error } = await supabase.from('course_registrations').upsert({
    course_id: courseId,
    user_id: user.id,
    status,
    waitlist_position: waitlistPos,
    applied_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'course_id,user_id' }).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
