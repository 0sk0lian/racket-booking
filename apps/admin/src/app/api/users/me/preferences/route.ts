/**
 * GET   /api/users/me/preferences — current user's theme & locale preferences
 * PATCH /api/users/me/preferences — update preferences (theme, locale)
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from '../../../../../lib/supabase/server';

const DEFAULTS = { theme: 'light', locale: 'sv' };

export async function GET() {
  const userSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 },
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('user_preferences')
    .select('theme, locale')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found — that's fine, return defaults
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: data ?? DEFAULTS,
  });
}

export async function PATCH(request: NextRequest) {
  const userSupabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 },
    );
  }

  const body = await request.json();

  // Validate inputs
  const updates: Record<string, string> = {};
  if (body.theme !== undefined) {
    if (body.theme !== 'light' && body.theme !== 'dark') {
      return NextResponse.json(
        { success: false, error: 'theme must be "light" or "dark"' },
        { status: 400 },
      );
    }
    updates.theme = body.theme;
  }
  if (body.locale !== undefined) {
    if (body.locale !== 'sv' && body.locale !== 'en') {
      return NextResponse.json(
        { success: false, error: 'locale must be "sv" or "en"' },
        { status: 400 },
      );
    }
    updates.locale = body.locale;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { success: false, error: 'No valid fields to update' },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdminClient();

  // Upsert: insert if not exists, update if exists
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: user.id,
        ...DEFAULTS,
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('theme, locale')
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
