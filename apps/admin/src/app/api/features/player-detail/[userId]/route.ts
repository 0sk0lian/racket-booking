import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess, scopeClubIdsForAdmin } from '../../../../../lib/auth/guards';

function parseDateString(value: string): string | null {
  if (!value) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (iso.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function ageFromBirthDate(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const dob = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  if (age < 0 || age > 120) return null;
  return age;
}

function extractProfileHints(answers: Record<string, unknown>) {
  let age: number | null = null;
  let socialNumber: string | null = null;
  let birthDate: string | null = null;

  const socialPattern = /\b\d{6,8}-?\d{4}\b/;

  for (const [rawKey, rawVal] of Object.entries(answers ?? {})) {
    const key = rawKey.toLowerCase();
    const val = rawVal == null ? '' : String(rawVal).trim();
    if (!val) continue;

    if (!socialNumber && (key.includes('social') || key.includes('person') || key.includes('ssn') || key.includes('nummer'))) {
      const match = val.match(socialPattern);
      if (match) socialNumber = match[0];
    }

    if (age === null && key.includes('age')) {
      const n = Number(val);
      if (Number.isFinite(n) && n > 0 && n < 120) age = Math.round(n);
    }

    if (!birthDate && (key.includes('birth') || key.includes('fodel') || key.includes('födel') || key.includes('dob'))) {
      birthDate = parseDateString(val);
    }

    if (!socialNumber) {
      const match = val.match(socialPattern);
      if (match) socialNumber = match[0];
    }
  }

  return { age, socialNumber, birthDate };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { userId } = await params;
  const clubId = request.nextUrl.searchParams.get('clubId');

  if (clubId) {
    const access = await requireClubAccess(clubId);
    if (!access.ok) return access.response;
  }

  const scopedClubIds = clubId ? [clubId] : await scopeClubIdsForAdmin(admin);
  const supabase = createSupabaseAdminClient();

  const { data: user, error: userError } = await supabase.from('users').select('*').eq('id', userId).single();
  if (userError || !user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  }

  let membershipsQuery = supabase
    .from('club_memberships')
    .select('id, club_id, status, membership_type, form_answers, payment_status, applied_at')
    .eq('user_id', userId);
  if (scopedClubIds !== null) membershipsQuery = membershipsQuery.in('club_id', scopedClubIds);
  const { data: memberships } = await membershipsQuery;

  const membershipClubIds = [...new Set((memberships ?? []).map((row) => row.club_id as string))];
  const { data: membershipClubs } = membershipClubIds.length > 0
    ? await supabase.from('clubs').select('id, name').in('id', membershipClubIds)
    : { data: [] };
  const membershipClubMap = new Map((membershipClubs ?? []).map((club) => [club.id, club.name]));

  const membershipsEnriched = (memberships ?? []).map((row) => ({
    id: row.id,
    club_id: row.club_id,
    club_name: membershipClubMap.get(row.club_id) ?? 'Unknown',
    status: row.status,
    membership_type: row.membership_type,
    form_answers: row.form_answers ?? {},
    payment_status: row.payment_status ?? 'unpaid',
    applied_at: row.applied_at,
  }));
  if (scopedClubIds !== null) {
    const trainerClubId = (user as any).trainer_club_id as string | null | undefined;
    const trainerInScope = !!trainerClubId && scopedClubIds.includes(trainerClubId);
    if (membershipsEnriched.length === 0 && !trainerInScope) {
      return NextResponse.json({ success: false, error: 'You do not have access to this member' }, { status: 403 });
    }
  }
  const primaryMembership = membershipsEnriched.find((row) => row.status === 'active') ?? membershipsEnriched[0] ?? null;

  let groupsQuery = supabase.from('groups').select('id, name, category, parent_group_id, player_ids, club_id');
  if (scopedClubIds !== null) groupsQuery = groupsQuery.in('club_id', scopedClubIds);
  const { data: allGroups } = await groupsQuery;

  const groupsForUser = (allGroups ?? []).filter((group: any) => Array.isArray(group.player_ids) && group.player_ids.includes(userId));
  const groupNameMap = new Map((allGroups ?? []).map((group: any) => [group.id, group.name]));
  const groups = groupsForUser.map((group: any) => ({
    id: group.id,
    name: group.name,
    category: group.category,
    parent_name: group.parent_group_id ? groupNameMap.get(group.parent_group_id) ?? null : null,
  }));

  let sessionsQuery = supabase
    .from('training_sessions')
    .select('id, title, day_of_week, start_hour, end_hour, status, trainer_id, court_id, applied_dates, club_id, player_ids')
    .contains('player_ids', [userId])
    .neq('status', 'cancelled');
  if (scopedClubIds !== null) sessionsQuery = sessionsQuery.in('club_id', scopedClubIds);
  const { data: rawSessions } = await sessionsQuery.order('day_of_week').order('start_hour');

  const trainerIds = [...new Set((rawSessions ?? []).map((session) => session.trainer_id).filter(Boolean))];
  const courtIds = [...new Set((rawSessions ?? []).map((session) => session.court_id).filter(Boolean))];
  const [{ data: trainers }, { data: courts }] = await Promise.all([
    trainerIds.length > 0 ? supabase.from('users').select('id, full_name').in('id', trainerIds) : { data: [] as any[] },
    courtIds.length > 0 ? supabase.from('courts').select('id, name').in('id', courtIds) : { data: [] as any[] },
  ]);
  const trainerMap = new Map((trainers ?? []).map((trainer) => [trainer.id, trainer.full_name]));
  const courtMap = new Map((courts ?? []).map((court) => [court.id, court.name]));
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const sessions = (rawSessions ?? []).map((session) => ({
    id: session.id,
    title: session.title,
    day_of_week: session.day_of_week,
    day_name: dayNames[session.day_of_week] ?? '?',
    start_hour: session.start_hour,
    end_hour: session.end_hour,
    status: session.status,
    trainer_name: trainerMap.get(session.trainer_id) ?? 'Unknown',
    court_name: courtMap.get(session.court_id) ?? 'Unknown',
    applied_count: Array.isArray(session.applied_dates) ? session.applied_dates.length : 0,
  }));

  const { data: submissionsRaw } = await supabase
    .from('form_submissions')
    .select('form_id, submitted_at, answers')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false });

  const formIds = [...new Set((submissionsRaw ?? []).map((submission) => submission.form_id as string))];
  let formsQuery = formIds.length > 0
    ? supabase.from('registration_forms').select('id, title, club_id').in('id', formIds)
    : null;
  if (formsQuery && scopedClubIds !== null) formsQuery = formsQuery.in('club_id', scopedClubIds);
  const { data: forms } = formsQuery ? await formsQuery : { data: [] };
  const formMap = new Map((forms ?? []).map((form) => [form.id, form]));

  const submissions = (submissionsRaw ?? [])
    .filter((submission) => formMap.has(submission.form_id))
    .map((submission) => ({
      form_title: formMap.get(submission.form_id)?.title ?? 'Form',
      submitted_at: submission.submitted_at,
      answers: (submission.answers ?? {}) as Record<string, unknown>,
    }));

  let inferredAge: number | null = null;
  let inferredSocialNumber: string | null = null;
  let inferredBirthDate: string | null = null;
  for (const submission of submissions) {
    const hints = extractProfileHints(submission.answers);
    if (inferredAge === null && hints.age !== null) inferredAge = hints.age;
    if (!inferredSocialNumber && hints.socialNumber) inferredSocialNumber = hints.socialNumber;
    if (!inferredBirthDate && hints.birthDate) inferredBirthDate = hints.birthDate;
  }

  const birthDate = parseDateString((user as any).birth_date) ?? inferredBirthDate;
  const age = ageFromBirthDate(birthDate) ?? inferredAge;
  const socialNumber = (user as any).social_number ?? inferredSocialNumber ?? null;

  let bookingCount = 0;
  if (scopedClubIds === null) {
    const { count } = await supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('booker_id', userId);
    bookingCount = count ?? 0;
  } else if (scopedClubIds.length > 0) {
    const { data: clubCourts } = await supabase.from('courts').select('id').in('club_id', scopedClubIds);
    const clubCourtIds = (clubCourts ?? []).map((court) => court.id);
    if (clubCourtIds.length > 0) {
      const { count } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('booker_id', userId)
        .in('court_id', clubCourtIds);
      bookingCount = count ?? 0;
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      age,
      social_number: socialNumber,
      membership_type: primaryMembership?.membership_type ?? null,
      memberships: membershipsEnriched,
      groups,
      sessions,
      submissions: submissions.map((submission) => ({
        form_title: submission.form_title,
        submitted_at: submission.submitted_at,
      })),
      bookingCount,
    },
  });
}
