/**
 * POST /api/recurrence-rules/:id/preview?from=&to=
 * Dry-run: returns per-date instances, conflicts, blackouts, skipped dates.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireClubAccess } from '../../../../../lib/auth/guards';
import { buildRecurrencePreview } from '../../../../../lib/recurrence';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: rule, error } = await supabase.from('recurrence_rules').select('*').eq('id', id).single();
  if (error || !rule) return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });
  const access = await requireClubAccess(rule.club_id);
  if (!access.ok) return access.response;

  const body = await request.json().catch(() => ({}));
  const from = request.nextUrl.searchParams.get('from') ?? body.from ?? rule.start_date;
  const to = request.nextUrl.searchParams.get('to') ?? body.to ?? rule.end_date ?? rule.start_date;
  const preview = await buildRecurrencePreview(rule, { from, to }, supabase);
  return NextResponse.json({ success: true, data: preview });
}
