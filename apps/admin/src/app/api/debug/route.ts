/**
 * GET /api/debug — diagnostic endpoint (remove before production).
 * Reports env var shapes + attempts a direct fetch to Supabase to isolate
 * connection issues. Never prints actual secret values.
 */
import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const pubKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  const secKey = process.env.SUPABASE_SECRET_KEY ?? '';

  const report: Record<string, unknown> = {
    env: {
      NEXT_PUBLIC_SUPABASE_URL: url ? `set (length=${url.length}, starts=${url.slice(0, 20)})` : 'MISSING',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pubKey ? `set (length=${pubKey.length}, prefix=${pubKey.slice(0, 16)}...)` : 'MISSING',
      SUPABASE_SECRET_KEY: secKey ? `set (length=${secKey.length}, prefix=${secKey.slice(0, 12)}...)` : 'MISSING',
    },
  };

  // Test 1: direct fetch to Supabase REST with publishable key
  try {
    const res = await fetch(`${url}/rest/v1/clubs?select=name`, {
      headers: { apikey: pubKey, Authorization: `Bearer ${pubKey}` },
    });
    const body = await res.text();
    report.test_publishable = { status: res.status, body_length: body.length, first_100: body.slice(0, 100) };
  } catch (e: any) {
    report.test_publishable = { error: e.message, cause: e.cause?.message ?? null };
  }

  // Test 2: direct fetch with secret key
  try {
    const res = await fetch(`${url}/rest/v1/clubs?select=name`, {
      headers: { apikey: secKey, Authorization: `Bearer ${secKey}` },
    });
    const body = await res.text();
    report.test_secret = { status: res.status, body_length: body.length, first_100: body.slice(0, 100) };
  } catch (e: any) {
    report.test_secret = { error: e.message, cause: e.cause?.message ?? null };
  }

  return NextResponse.json(report);
}
