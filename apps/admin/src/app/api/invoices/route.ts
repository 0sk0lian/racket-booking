/**
 * GET  /api/invoices?clubId=&userId=&status=  - list invoices
 * POST /api/invoices                          - create invoice (auto or manual)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../lib/supabase/server';
import { requireAdmin, requireClubAccess } from '../../../lib/auth/guards';
import { createInvoiceRecord } from '../../../lib/invoices';

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const clubId = request.nextUrl.searchParams.get('clubId');
  const userId = request.nextUrl.searchParams.get('userId');
  const status = request.nextUrl.searchParams.get('status');

  if (!clubId) return NextResponse.json({ success: false, error: 'clubId required' }, { status: 400 });
  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  const supabase = createSupabaseAdminClient();
  let query = supabase.from('invoices').select('*').eq('club_id', clubId).order('created_at', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const userIds = [...new Set((data ?? []).map((invoice) => invoice.user_id))];
  const { data: users } = userIds.length > 0
    ? await supabase.from('users').select('id, full_name, email').in('id', userIds)
    : { data: [] };
  const userMap = new Map((users ?? []).map((user) => [user.id, user]));

  const enriched = (data ?? []).map((invoice) => ({
    ...invoice,
    user_name: userMap.get(invoice.user_id)?.full_name ?? 'Unknown',
    user_email: userMap.get(invoice.user_id)?.email ?? null,
  }));

  return NextResponse.json({ success: true, data: enriched });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await request.json();
  const { clubId, userId, membershipId, description, amount, dueDate } = body;

  if (!clubId || !userId) {
    return NextResponse.json({ success: false, error: 'clubId and userId required' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  try {
    const invoice = await createInvoiceRecord({
      clubId,
      userId,
      membershipId,
      description,
      amount,
      dueDate,
    });

    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create invoice';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
