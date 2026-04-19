import type { User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient, createSupabaseServerClient } from '../supabase/server';

export type PlatformRole = 'player' | 'trainer' | 'admin' | 'superadmin';

type AuthOk<T extends boolean = boolean> = {
  ok: true;
  user: User;
  role: PlatformRole | null;
  isAdmin: T;
  isSuperadmin: boolean;
};

type AuthError = {
  ok: false;
  response: NextResponse;
};

function authError(status: number, error: string): AuthError {
  return {
    ok: false,
    response: NextResponse.json({ success: false, error }, { status }),
  };
}

export async function getRequestUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export async function getUserRole(userId: string): Promise<PlatformRole | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('users').select('role').eq('id', userId).single();
  return (data?.role as PlatformRole | null) ?? null;
}

export async function getManagedClubIds(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from('club_admins').select('club_id').eq('user_id', userId);
  return (data ?? []).map((row) => row.club_id as string);
}

export async function requireUser(): Promise<AuthOk<false> | AuthError> {
  const user = await getRequestUser();
  if (!user) return authError(401, 'Authentication required');

  const role = await getUserRole(user.id);
  return {
    ok: true,
    user,
    role,
    isAdmin: false,
    isSuperadmin: role === 'superadmin',
  };
}

export async function requireAdmin(): Promise<AuthOk<true> | AuthError> {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  if (auth.role !== 'admin' && auth.role !== 'superadmin') {
    return authError(403, 'Admin access required');
  }

  return {
    ok: true,
    user: auth.user,
    role: auth.role,
    isAdmin: true,
    isSuperadmin: auth.role === 'superadmin',
  };
}

export async function requireSuperadmin(): Promise<AuthOk<true> | AuthError> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  if (!admin.isSuperadmin) return authError(403, 'Superadmin access required');
  return admin;
}

export async function requireClubAccess(clubId: string): Promise<AuthOk<true> | AuthError> {
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  if (admin.isSuperadmin) return admin;

  const managedClubIds = await getManagedClubIds(admin.user.id);
  if (!managedClubIds.includes(clubId)) {
    return authError(403, 'You do not have access to this venue');
  }

  return admin;
}

export async function scopeClubIdsForAdmin(admin: AuthOk<true>) {
  if (admin.isSuperadmin) return null;
  return getManagedClubIds(admin.user.id);
}

/**
 * Requires at least staff-level access to a club.
 * Staff can: view schedule, check-in attendance, view members (read-only on most things).
 * Returns the staff role ('owner' | 'admin' | 'staff') for the specific club.
 */
export async function requireStaffAccess(clubId: string): Promise<
  { ok: true; user: User; clubRole: 'owner' | 'admin' | 'staff'; isSuperadmin: boolean; response?: never } |
  { ok: false; response: NextResponse; user?: never; clubRole?: never; isSuperadmin?: never }
> {
  const admin = await requireAdmin();
  if (!admin.ok) {
    // Not an admin — but might be staff
    const user = await getRequestUser();
    if (!user) return { ok: false, response: NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 }) };

    const supabase = createSupabaseAdminClient();
    const { data: assignment } = await supabase
      .from('club_admins')
      .select('role')
      .eq('user_id', user.id)
      .eq('club_id', clubId)
      .maybeSingle();

    if (!assignment) {
      return { ok: false, response: NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 }) };
    }

    return { ok: true, user, clubRole: assignment.role, isSuperadmin: false };
  }

  // Admin or superadmin
  if (admin.isSuperadmin) {
    return { ok: true, user: admin.user, clubRole: 'owner', isSuperadmin: true };
  }

  const supabase = createSupabaseAdminClient();
  const { data: assignment } = await supabase
    .from('club_admins')
    .select('role')
    .eq('user_id', admin.user.id)
    .eq('club_id', clubId)
    .maybeSingle();

  return { ok: true, user: admin.user, clubRole: assignment?.role ?? 'admin', isSuperadmin: false };
}

/**
 * Checks if the staff member has write access (owner or admin, not staff).
 */
export function canWrite(clubRole: string): boolean {
  return clubRole === 'owner' || clubRole === 'admin';
}
