/**
 * GET /api/users/me/memberships — current user's memberships with club details
 */
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireUser } from '../../../../../lib/auth/guards';

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const supabase = createSupabaseAdminClient();
  const { data: memberships, error } = await supabase
    .from('club_memberships')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('applied_at', { ascending: false });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  if (!memberships?.length) return NextResponse.json({ success: true, data: [] });

  const clubIds = [...new Set(memberships.map((row) => row.club_id))];
  const { data: clubs } = clubIds.length > 0
    ? await supabase.from('clubs').select('id, name, city').in('id', clubIds)
    : { data: [] };
  const clubMap = new Map((clubs ?? []).map((row) => [row.id, row]));

  const enriched = memberships.map((membership) => ({
    ...membership,
    club_name: clubMap.get(membership.club_id)?.name ?? null,
    club_city: clubMap.get(membership.club_id)?.city ?? null,
  }));

  return NextResponse.json({ success: true, data: enriched });
}
