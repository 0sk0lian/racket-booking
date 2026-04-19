/**
 * GET  /api/registration-forms?clubId=&status=&category=
 * POST /api/registration-forms
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';
import { requireAdmin, requireClubAccess, requireUser } from '../../../lib/auth/guards';
import { autoCloseExpiredForms, autoOpenScheduledForms } from '../../../lib/form-automations';

export async function GET(request: NextRequest) {
  const clubId = request.nextUrl.searchParams.get('clubId');
  const status = request.nextUrl.searchParams.get('status');
  const category = request.nextUrl.searchParams.get('category');

  if (!clubId) {
    return NextResponse.json({ success: false, error: 'clubId is required' }, { status: 400 });
  }

  // Side effect: auto-open/close forms based on dates
  await Promise.all([autoCloseExpiredForms(), autoOpenScheduledForms()]);

  const admin = await requireAdmin();
  const isAdmin = admin.ok;

  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('registration_forms')
    .select('*')
    .eq('club_id', clubId);

  if (!isAdmin) {
    // Non-admin users only see open forms
    query = query.eq('status', 'open');
  } else if (status) {
    query = query.eq('status', status);
  }

  if (category) {
    query = query.eq('category', category);
  }

  const { data: forms, error } = await query.order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Enrich with submission counts, assigned counts, target group name, spots remaining
  const formIds = (forms ?? []).map(f => f.id);
  const groupIds = (forms ?? []).map(f => f.target_group_id).filter(Boolean) as string[];

  // Fetch submission counts per form
  const { data: submissions } = formIds.length > 0
    ? await supabase
        .from('form_submissions')
        .select('form_id, assigned_to_group')
        .in('form_id', formIds)
    : { data: [] };

  // Fetch target group names
  const { data: groups } = groupIds.length > 0
    ? await supabase
        .from('groups')
        .select('id, name')
        .in('id', groupIds)
    : { data: [] };

  const groupMap = new Map((groups ?? []).map(g => [g.id, g.name]));

  // Build counts per form
  const countMap = new Map<string, { total: number; assigned: number }>();
  for (const sub of submissions ?? []) {
    const entry = countMap.get(sub.form_id) ?? { total: 0, assigned: 0 };
    entry.total++;
    if (sub.assigned_to_group) entry.assigned++;
    countMap.set(sub.form_id, entry);
  }

  const enriched = (forms ?? []).map(f => {
    const counts = countMap.get(f.id) ?? { total: 0, assigned: 0 };
    return {
      ...f,
      submission_count: counts.total,
      assigned_count: counts.assigned,
      target_group_name: f.target_group_id ? (groupMap.get(f.target_group_id) ?? null) : null,
      spots_remaining: f.max_submissions != null ? f.max_submissions - counts.total : null,
    };
  });

  return NextResponse.json({ success: true, data: enriched });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json();
  const { clubId, title, description, sportType, category, season, targetGroupId, parentGroupId, fields, maxSubmissions } = body;

  if (!clubId || !title || !sportType || !category || !season) {
    return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();

  let finalGroupId = targetGroupId || null;

  // If no target group specified, auto-create one
  if (!finalGroupId) {
    const { data: newGroup, error: groupError } = await supabase
      .from('groups')
      .insert({
        club_id: clubId,
        name: title,
        category: category,
        sport_type: sportType,
        parent_group_id: parentGroupId || null,
        player_ids: [],
        is_active: true,
      })
      .select('id')
      .single();

    if (groupError) {
      return NextResponse.json({ success: false, error: 'Failed to create group: ' + groupError.message }, { status: 500 });
    }
    finalGroupId = newGroup.id;
  }

  const { data: form, error } = await supabase
    .from('registration_forms')
    .insert({
      club_id: clubId,
      title,
      description: description || null,
      sport_type: sportType,
      category,
      season,
      target_group_id: finalGroupId,
      fields: fields || [],
      status: 'draft',
      max_submissions: maxSubmissions || null,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: form }, { status: 201 });
}
