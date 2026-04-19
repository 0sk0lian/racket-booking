/**
 * GET /api/registration-forms/:id/submissions
 * Returns all submissions for this form, enriched with user name/email.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireAdmin } from '../../../../../lib/auth/guards';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id: formId } = await context.params;
  const supabase = createSupabaseAdminClient();

  const { data: submissions, error } = await supabase
    .from('form_submissions')
    .select('*')
    .eq('form_id', formId)
    .order('submitted_at', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const userIds = (submissions ?? []).map(s => s.user_id);
  const { data: users } = userIds.length > 0
    ? await supabase.from('users').select('id, full_name, email').in('id', userIds)
    : { data: [] };

  const userMap = new Map((users ?? []).map(u => [u.id, u]));

  const enriched = (submissions ?? []).map(s => {
    const user = userMap.get(s.user_id);
    return {
      ...s,
      user_name: user?.full_name ?? 'Unknown',
      user_email: user?.email ?? '',
    };
  });

  return NextResponse.json({ success: true, data: enriched });
}
