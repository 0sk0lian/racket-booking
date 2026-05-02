/**
 * Push subscription API
 *
 * POST — save a push subscription for the authenticated user
 *        Body: { subscription } (PushSubscription JSON from browser)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireUser } from '../../../../lib/auth/guards';

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const subscription = body.subscription;

  if (!subscription || !subscription.endpoint) {
    return NextResponse.json({ success: false, error: 'Valid push subscription required' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Upsert into user_preferences
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: auth.user.id,
        push_subscription: subscription,
      },
      { onConflict: 'user_id' },
    );

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
