/**
 * GET  /api/clubs/:id/membership - check current user's membership status
 * POST /api/clubs/:id/membership - apply for membership
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../../../../../lib/supabase/server';
import { resolveClubId } from '../../../../../lib/clubs';

type MembershipFormField = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'date';
  required?: boolean;
  options?: string[];
};

function isEmptyAnswer(value: unknown) {
  return value === undefined || value === null || value === '' || value === false;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clubIdentifier } = await params;
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: true, data: { status: 'none' } });
  }

  const supabase = createSupabaseAdminClient();
  const clubId = await resolveClubId(clubIdentifier, supabase);
  if (!clubId) return NextResponse.json({ success: false, error: 'Club not found' }, { status: 404 });
  const { data } = await supabase
    .from('club_memberships')
    .select('*')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .single();

  return NextResponse.json({ success: true, data: data ?? { status: 'none' } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clubIdentifier } = await params;
  const userSupabase = await createSupabaseServerClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) return NextResponse.json({ success: false, error: 'Du måste vara inloggad' }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  const clubId = await resolveClubId(clubIdentifier, supabase);
  if (!clubId) return NextResponse.json({ success: false, error: 'Club not found' }, { status: 404 });

  const { data: existing } = await supabase
    .from('club_memberships')
    .select('status')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .single();

  if (existing?.status === 'active') {
    return NextResponse.json({ success: false, error: 'Du är redan medlem i denna klubb' }, { status: 400 });
  }
  if (existing?.status === 'approved') {
    return NextResponse.json({ success: false, error: 'Din ansökan är redan godkänd och väntar på betalning' }, { status: 400 });
  }
  if (existing?.status === 'pending') {
    return NextResponse.json({ success: false, error: 'Du har redan en väntande ansökan' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const membershipType = String(body.membershipType ?? '').trim();
  const answers = (body.formAnswers ?? {}) as Record<string, unknown>;
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!membershipType) {
    return NextResponse.json({ success: false, error: 'Välj en medlemskapstyp' }, { status: 400 });
  }

  const { data: typeRow } = await supabase
    .from('membership_types')
    .select('name, form_fields')
    .eq('club_id', clubId)
    .eq('name', membershipType)
    .eq('is_active', true)
    .maybeSingle();

  if (!typeRow) {
    return NextResponse.json({ success: false, error: 'Medlemskapstypen hittades inte' }, { status: 404 });
  }

  const formFields = Array.isArray(typeRow.form_fields) ? (typeRow.form_fields as MembershipFormField[]) : [];
  for (const field of formFields) {
    if (field.required && isEmptyAnswer(answers[field.key])) {
      return NextResponse.json({ success: false, error: `${field.label} krävs` }, { status: 400 });
    }

    if (field.type === 'select' && !isEmptyAnswer(answers[field.key]) && Array.isArray(field.options) && !field.options.includes(String(answers[field.key]))) {
      return NextResponse.json({ success: false, error: `${field.label} har ett ogiltigt värde` }, { status: 400 });
    }
  }

  const normalizedAnswers = { ...answers };
  if (message) normalizedAnswers.meddelande = message;

  const { data, error } = await supabase
    .from('club_memberships')
    .upsert({
      club_id: clubId,
      user_id: user.id,
      status: 'pending',
      payment_status: 'unpaid',
      membership_type: membershipType,
      form_answers: normalizedAnswers,
      notes: message || null,
      applied_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'club_id,user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
