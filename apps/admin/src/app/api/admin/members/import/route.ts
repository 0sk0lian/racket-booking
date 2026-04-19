/**
 * POST /api/admin/members/import
 *
 * Accepts CSV text in the request body and creates member accounts.
 * Body: { clubId, csv } where csv is the raw CSV string.
 * CSV columns: name, email, phone, membershipType
 *
 * Returns: { created, existing, failed, tempPasswords: [{ email, password }] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../../../lib/auth/guards';
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

interface CsvRow {
  name: string;
  email: string;
  phone: string;
  membershipType: string;
}

function parseCsv(csv: string): CsvRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return []; // header + at least one data row

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const nameIdx = headers.indexOf('name');
  const emailIdx = headers.indexOf('email');
  const phoneIdx = headers.indexOf('phone');
  const typeIdx = headers.indexOf('membershiptype');

  if (emailIdx === -1) return []; // email column is required

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    rows.push({
      name: nameIdx >= 0 ? cols[nameIdx] ?? '' : '',
      email: emailIdx >= 0 ? cols[emailIdx] ?? '' : '',
      phone: phoneIdx >= 0 ? cols[phoneIdx] ?? '' : '',
      membershipType: typeIdx >= 0 ? cols[typeIdx] ?? '' : '',
    });
  }
  return rows;
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json();
  const { clubId, csv } = body;

  if (!clubId || !csv) {
    return NextResponse.json({ success: false, error: 'clubId and csv are required' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const rows = parseCsv(csv);
  if (rows.length === 0) {
    return NextResponse.json(
      { success: false, error: 'CSV must have a header row with at least an email column, plus data rows' },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const authSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let created = 0;
  let existing = 0;
  let failed = 0;
  const tempPasswords: { email: string; password: string }[] = [];
  const errors: { row: number; email: string; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const email = row.email.toLowerCase().trim();
    if (!email) {
      failed++;
      errors.push({ row: i + 2, email: row.email, error: 'Missing email' });
      continue;
    }

    try {
      // Check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
        existing++;
      } else {
        // Create auth user with temp password
        const tempPassword = generateTempPassword();

        const { data: authData, error: authErr } = await authSupabase.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: row.name || email.split('@')[0],
            must_change_password: true,
          },
        });

        if (authErr) {
          failed++;
          errors.push({ row: i + 2, email, error: authErr.message });
          continue;
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
            email,
            full_name: row.name || email.split('@')[0],
            phone: row.phone || null,
            role: 'player',
          });
        } else if (row.phone) {
          await supabase.from('users').update({ phone: row.phone }).eq('id', userId);
        }

        tempPasswords.push({ email, password: tempPassword });
        created++;
      }

      // Create/update club_membership
      await supabase.from('club_memberships').upsert(
        {
          club_id: clubId,
          user_id: userId,
          status: 'active',
          membership_type: row.membershipType || null,
        },
        { onConflict: 'club_id,user_id' },
      );
    } catch (err: unknown) {
      failed++;
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ row: i + 2, email, error: message });
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      created,
      existing,
      failed,
      tempPasswords,
      errors: errors.length > 0 ? errors : undefined,
    },
  });
}
