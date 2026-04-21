/**
 * GET    /api/users/:id  — get user profile (admin)
 * PATCH  /api/users/:id  — update user fields (admin)
 * DELETE /api/users/:id  — deactivate user (admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../lib/supabase/server';
import { requireAdmin } from '../../../../lib/auth/guards';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
  if (error || !data) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
  return NextResponse.json({ success: true, data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const body = await request.json();
  const supabase = createSupabaseAdminClient();

  const camelToSnake: Record<string, string> = {
    fullName: 'full_name',
    phoneNumber: 'phone_number',
    trainerClubId: 'trainer_club_id',
    trainerSportTypes: 'trainer_sport_types',
    trainerHourlyRate: 'trainer_hourly_rate',
    trainerMonthlySalary: 'trainer_monthly_salary',
    trainerRates: 'trainer_rates',
  };

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // Direct fields
  for (const key of ['role', 'email', 'notes']) {
    if (body[key] !== undefined) updates[key] = body[key];
  }

  // camelCase → snake_case fields
  for (const [camel, snake] of Object.entries(camelToSnake)) {
    if (body[camel] !== undefined) updates[snake] = body[camel];
  }

  // Role validation
  if (updates.role && !['player', 'trainer', 'admin', 'superadmin'].includes(updates.role as string)) {
    return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 });
  }

  const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  // Soft deactivate — don't delete, just mark inactive
  const { error } = await supabase.from('users').update({
    is_active: false,
    updated_at: new Date().toISOString(),
  }).eq('id', id);

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
