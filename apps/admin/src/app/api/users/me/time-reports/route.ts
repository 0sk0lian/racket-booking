import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../lib/supabase/server';
import { requireUser } from '../../../../../lib/auth/guards';

const ALLOWED_TYPES = new Set(['training', 'admin', 'event', 'other']);

async function getTrainerContext() {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  if (auth.role !== 'trainer') {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: 'Endast tränare kan använda denna funktion' }, { status: 403 }),
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('id, full_name, trainer_club_id')
    .eq('id', auth.user.id)
    .single();

  if (error || !user?.trainer_club_id) {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: 'Ingen tränarklubb är kopplad till ditt konto' }, { status: 400 }),
    };
  }

  return {
    ok: true as const,
    auth,
    supabase,
    trainer: user,
    clubId: user.trainer_club_id as string,
  };
}

export async function GET(request: NextRequest) {
  const context = await getTrainerContext();
  if (!context.ok) return context.response;

  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  let query = context.supabase
    .from('time_reports')
    .select('id, date, hours, type, description, approved, booking_id, created_at')
    .eq('user_id', context.trainer.id)
    .eq('club_id', context.clubId)
    .order('date', { ascending: false });

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);

  const { data: reports, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const totalHours = (reports ?? []).reduce((sum, report) => sum + Number(report.hours ?? 0), 0);
  const approvedHours = (reports ?? [])
    .filter((report) => report.approved)
    .reduce((sum, report) => sum + Number(report.hours ?? 0), 0);
  const pendingHours = Number((totalHours - approvedHours).toFixed(2));

  return NextResponse.json({
    success: true,
    data: {
      trainer: {
        id: context.trainer.id,
        full_name: context.trainer.full_name,
        club_id: context.clubId,
      },
      reports: reports ?? [],
      summary: {
        totalHours: Number(totalHours.toFixed(2)),
        approvedHours: Number(approvedHours.toFixed(2)),
        pendingHours,
      },
    },
  });
}

export async function POST(request: NextRequest) {
  const context = await getTrainerContext();
  if (!context.ok) return context.response;

  const body = await request.json();
  const date = body?.date as string | undefined;
  const hours = Number(body?.hours ?? 0);
  const type = (body?.type as string | undefined) ?? 'other';
  const description = (body?.description as string | undefined) ?? null;
  const bookingId = (body?.bookingId as string | undefined) ?? null;

  if (!date || !Number.isFinite(hours) || hours <= 0) {
    return NextResponse.json({ success: false, error: 'Datum och positiva timmar krävs' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ success: false, error: 'Ogiltig rapporttyp' }, { status: 400 });
  }

  if (bookingId) {
    const { data: booking } = await context.supabase
      .from('bookings')
      .select('id, trainer_id, court_id')
      .eq('id', bookingId)
      .single();
    if (!booking || booking.trainer_id !== context.trainer.id) {
      return NextResponse.json({ success: false, error: 'Du kan bara rapportera timmar för egna pass' }, { status: 403 });
    }
  }

  const { data, error } = await context.supabase
    .from('time_reports')
    .insert({
      user_id: context.trainer.id,
      club_id: context.clubId,
      date,
      hours,
      type,
      description,
      booking_id: bookingId,
      approved: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}
