/**
 * GET  /api/clubs/:id/membership — check current user's membership status
 * POST /api/clubs/:id/membership — apply for membership
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../../lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clubId } = await params;
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: true, data: { status: 'none' } });
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('club_memberships')
    .select('*').eq('club_id', clubId).eq('user_id', user.id).single();

  return NextResponse.json({ success: true, data: data ?? { status: 'none' } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clubId } = await params;
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Du måste vara inloggad' }, { status: 401 });

  const supabase = createSupabaseAdminClient();

  // Check for existing membership — block if pending, approved, or active
  const { data: existing } = await supabase.from('club_memberships')
    .select('status').eq('club_id', clubId).eq('user_id', user.id).single();

  if (existing?.status === 'active') {
    return NextResponse.json({ success: false, error: 'Du är redan medlem i denna klubb' }, { status: 400 });
  }
  if (existing?.status === 'approved') {
    return NextResponse.json({ success: false, error: 'Du har redan ett godkänt medlemskap' }, { status: 400 });
  }
  if (existing?.status === 'pending') {
    return NextResponse.json({ success: false, error: 'Du har redan en väntande ansökan' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const answers = body.formAnswers ?? {};

  // Validate required fields
  if (!answers.fornamn?.trim()) return NextResponse.json({ success: false, error: 'Förnamn krävs' }, { status: 400 });
  if (!answers.efternamn?.trim()) return NextResponse.json({ success: false, error: 'Efternamn krävs' }, { status: 400 });
  if (!answers.telefon?.trim()) return NextResponse.json({ success: false, error: 'Telefonnummer krävs' }, { status: 400 });
  if (!answers.personnummer?.trim()) return NextResponse.json({ success: false, error: 'Personnummer krävs' }, { status: 400 });
  if (!answers.sport) return NextResponse.json({ success: false, error: 'Välj sport' }, { status: 400 });

  const { data, error } = await supabase.from('club_memberships').upsert({
    club_id: clubId,
    user_id: user.id,
    status: 'pending',
    membership_type: body.membershipType ?? 'standard',
    form_answers: answers,
    notes: answers.meddelande ?? null,
    applied_at: new Date().toISOString(),
  }, { onConflict: 'club_id,user_id' }).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
