/**
 * POST /api/admin/members/add
 * Manually add a member to a club. Creates user if they don't exist.
 *
 * Body: { clubId, email, membershipType?, notes? }
 * Returns: { success, data: { membership, tempPassword? } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../../lib/auth/guards';
import crypto from 'crypto';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  const bytes = crypto.randomBytes(10);
  for (let i = 0; i < 10; i++) {
    pw += chars[bytes[i] % chars.length];
  }
  return pw + '!';
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { clubId, email, membershipType, notes } = body;

  if (!clubId || !email) {
    return NextResponse.json({ success: false, error: 'clubId and email required' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check if club exists
  const { data: club } = await supabase.from('clubs').select('id, name').eq('id', clubId).single();
  if (!club) {
    return NextResponse.json({ success: false, error: 'Club not found' }, { status: 404 });
  }

  // 2. Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email, full_name')
    .eq('email', normalizedEmail)
    .maybeSingle();

  let userId: string;
  let isNewUser = false;
  let tempPassword: string | null = null;

  if (existingUser) {
    userId = existingUser.id;

    // Check if they already have an active membership for this club
    const { data: existingMembership } = await supabase
      .from('club_memberships')
      .select('id, status')
      .eq('club_id', clubId)
      .eq('user_id', userId)
      .in('status', ['active', 'pending'])
      .maybeSingle();

    if (existingMembership) {
      return NextResponse.json(
        { success: false, error: 'User already has an active or pending membership for this club' },
        { status: 409 },
      );
    }
  } else {
    // 3. Create new auth user
    isNewUser = true;
    tempPassword = generateTempPassword();

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: normalizedEmail.split('@')[0],
        must_change_password: true,
      },
    });

    if (authErr) {
      return NextResponse.json({ success: false, error: authErr.message }, { status: 400 });
    }

    userId = authData.user.id;

    // Wait for trigger to create public.users row
    await new Promise((r) => setTimeout(r, 1500));

    // Verify public.users row exists, create if trigger didn't fire
    const { data: newProfile } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!newProfile) {
      await supabase.from('users').insert({
        id: userId,
        email: normalizedEmail,
        full_name: normalizedEmail.split('@')[0],
        role: 'player',
      });
    }
  }

  // 4. Create active membership
  const { data: membership, error: membershipErr } = await supabase
    .from('club_memberships')
    .insert({
      club_id: clubId,
      user_id: userId,
      membership_type: membershipType ?? null,
      status: 'active',
      notes: notes ?? null,
      applied_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
      approved_by: access.user.id,
    })
    .select()
    .single();

  if (membershipErr) {
    return NextResponse.json({ success: false, error: membershipErr.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    data: {
      membership,
      isNewUser,
      tempPassword: isNewUser ? tempPassword : undefined,
    },
  }, { status: 201 });
}
