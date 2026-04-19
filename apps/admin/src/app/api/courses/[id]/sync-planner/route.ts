import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../../lib/auth/guards';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id: courseId } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: course } = await supabase
    .from('courses')
    .select('id, club_id, name, trainer_id, court_id, day_of_week, start_hour, end_hour')
    .eq('id', courseId)
    .single();
  if (!course) return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });

  const access = await requireClubAccess(course.club_id);
  if (!access.ok) return access.response;

  if (!course.trainer_id || !course.court_id) {
    return NextResponse.json({ success: false, error: 'Course must have trainer and court before sync' }, { status: 400 });
  }

  const { data: approvedRegs } = await supabase
    .from('course_registrations')
    .select('user_id')
    .eq('course_id', courseId)
    .eq('status', 'approved');
  const playerIds = [...new Set((approvedRegs ?? []).map((row) => row.user_id).filter(Boolean))];
  if (playerIds.length === 0) {
    return NextResponse.json({ success: true, data: { created: false, addedPlayers: 0, totalPlayers: 0 } });
  }

  const sourceTag = `[course:${courseId}]`;
  const { data: existingTemplate } = await supabase
    .from('training_sessions')
    .select('id, player_ids')
    .eq('club_id', course.club_id)
    .ilike('notes', `%${sourceTag}%`)
    .limit(1)
    .maybeSingle();

  if (existingTemplate) {
    const merged = [...new Set([...(existingTemplate.player_ids ?? []), ...playerIds])];
    const addedPlayers = merged.length - (existingTemplate.player_ids ?? []).length;

    const { data, error } = await supabase
      .from('training_sessions')
      .update({
        title: course.name,
        court_id: course.court_id,
        trainer_id: course.trainer_id,
        player_ids: merged,
        day_of_week: course.day_of_week,
        start_hour: course.start_hour,
        end_hour: course.end_hour,
        notes: `Auto-synced from course ${sourceTag}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingTemplate.id)
      .select('id, player_ids')
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    return NextResponse.json({
      success: true,
      data: {
        created: false,
        templateId: data.id,
        addedPlayers,
        totalPlayers: (data.player_ids ?? []).length,
      },
    });
  }

  const { data, error } = await supabase
    .from('training_sessions')
    .insert({
      club_id: course.club_id,
      title: course.name,
      court_id: course.court_id,
      trainer_id: course.trainer_id,
      player_ids: playerIds,
      day_of_week: course.day_of_week,
      start_hour: course.start_hour,
      end_hour: course.end_hour,
      notes: `Auto-synced from course ${sourceTag}`,
      status: 'planned',
    })
    .select('id, player_ids')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({
    success: true,
    data: {
      created: true,
      templateId: data.id,
      addedPlayers: playerIds.length,
      totalPlayers: (data.player_ids ?? []).length,
    },
  });
}
