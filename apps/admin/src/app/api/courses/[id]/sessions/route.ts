/**
 * GET /api/courses/:id/sessions — list sessions for a course
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = await params;
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.from('course_sessions').select('*')
    .eq('course_id', courseId).order('date');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Enrich with court/trainer names for overridden sessions
  const courtIds = [...new Set((data ?? []).filter(s => s.court_id).map(s => s.court_id))];
  const trainerIds = [...new Set((data ?? []).filter(s => s.trainer_id).map(s => s.trainer_id))];

  const [{ data: courts }, { data: trainers }] = await Promise.all([
    courtIds.length > 0 ? supabase.from('courts').select('id, name').in('id', courtIds) : { data: [] as any[] },
    trainerIds.length > 0 ? supabase.from('users').select('id, full_name').in('id', trainerIds) : { data: [] as any[] },
  ]);
  const courtMap = new Map((courts ?? []).map(c => [c.id, c]));
  const trainerMap = new Map((trainers ?? []).map(t => [t.id, t]));

  const enriched = (data ?? []).map(s => ({
    ...s,
    court_name: s.court_id ? courtMap.get(s.court_id)?.name : null,
    trainer_name: s.trainer_id ? trainerMap.get(s.trainer_id)?.full_name : null,
  }));

  return NextResponse.json({ success: true, data: enriched });
}
