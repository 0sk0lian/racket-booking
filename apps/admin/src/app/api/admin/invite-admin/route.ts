/**
 * POST /api/admin/invite-admin
 *
 * Invites an admin to a club by email. If the user doesn't exist yet,
 * creates an account with a one-time password and flags them to change
 * it on first login.
 *
 * Body: { email, clubId, role?, fullName? }
 * Returns: { success, data: { userId, isNewUser, tempPassword? } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireSuperadmin } from '../../../../lib/auth/guards';
import crypto from 'crypto';

function generateTempPassword(): string {
  // 10-char password with letters, digits, and a symbol
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  const bytes = crypto.randomBytes(10);
  for (let i = 0; i < 10; i++) {
    pw += chars[bytes[i] % chars.length];
  }
  return pw + '!';
}

export async function POST(request: NextRequest) {
  const superadmin = await requireSuperadmin();
  if (!superadmin.ok) return superadmin.response;

  const body = await request.json();
  const { email, clubId, role, fullName } = body;

  if (!email || !clubId) {
    return NextResponse.json({ success: false, error: 'email and clubId required' }, { status: 400 });
  }

  const adminRole = role && ['owner', 'admin', 'staff'].includes(role) ? role : 'admin';
  const supabase = createSupabaseAdminClient();

  // 1. Check if club exists
  const { data: club } = await supabase.from('clubs').select('id, name').eq('id', clubId).single();
  if (!club) {
    return NextResponse.json({ success: false, error: 'Club not found' }, { status: 404 });
  }

  // 2. Check if user already exists in public.users
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email, full_name, role')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  let userId: string;
  let isNewUser = false;
  let tempPassword: string | null = null;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    // 3. Create new auth user with temp password
    isNewUser = true;
    tempPassword = generateTempPassword();

    const authSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: authData, error: authErr } = await authSupabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || email.split('@')[0],
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
        email: email.toLowerCase().trim(),
        full_name: fullName || email.split('@')[0],
        role: 'admin',
      });
    }
  }

  // 4. Promote to admin if still a player
  const { data: profile } = await supabase.from('users').select('role').eq('id', userId).single();
  if (profile?.role === 'player') {
    await supabase.from('users').update({ role: 'admin' }).eq('id', userId);
  }

  // 5. Set must_change_password in user_metadata if new user
  if (isNewUser) {
    const authSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    await authSupabase.auth.admin.updateUserById(userId, {
      user_metadata: { must_change_password: true },
    });
  }

  // 6. Assign to club (upsert)
  const { error: assignErr } = await supabase.from('club_admins').upsert(
    { club_id: clubId, user_id: userId, role: adminRole },
    { onConflict: 'club_id,user_id' },
  );

  if (assignErr) {
    return NextResponse.json({ success: false, error: assignErr.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    data: {
      userId,
      email: email.toLowerCase().trim(),
      clubName: club.name,
      isNewUser,
      tempPassword: isNewUser ? tempPassword : undefined,
    },
  });
}
