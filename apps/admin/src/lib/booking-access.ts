import { NextResponse } from 'next/server';
import { requireClubAccess, requireUser } from './auth/guards';
import { createSupabaseAdminClient } from './supabase/server';

type BookingAccessResult =
  | {
      ok: true;
      booking: {
        id: string;
        trainer_id: string | null;
        court_id: string | null;
        club_id: string;
      };
      userId: string;
      role: string | null;
      isAssignedTrainer: boolean;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireBookingTrainerOrAdmin(bookingId: string): Promise<BookingAccessResult> {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  const supabase = createSupabaseAdminClient();
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, trainer_id, court_id')
    .eq('id', bookingId)
    .single();

  if (!booking?.court_id) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Bokningen hittades inte' }, { status: 404 }),
    };
  }

  const { data: court } = await supabase
    .from('courts')
    .select('club_id')
    .eq('id', booking.court_id)
    .single();

  if (!court?.club_id) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Banan hittades inte' }, { status: 404 }),
    };
  }

  const isAssignedTrainer = auth.role === 'trainer' && booking.trainer_id === auth.user.id;
  if (isAssignedTrainer) {
    return {
      ok: true,
      booking: {
        id: booking.id,
        trainer_id: booking.trainer_id,
        court_id: booking.court_id,
        club_id: court.club_id,
      },
      userId: auth.user.id,
      role: auth.role,
      isAssignedTrainer: true,
    };
  }

  const adminAccess = await requireClubAccess(court.club_id);
  if (!adminAccess.ok) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Du har inte tillgång till denna bokning' }, { status: 403 }),
    };
  }

  return {
    ok: true,
    booking: {
      id: booking.id,
      trainer_id: booking.trainer_id,
      court_id: booking.court_id,
      club_id: court.club_id,
    },
    userId: adminAccess.user.id,
    role: adminAccess.role,
    isAssignedTrainer: false,
  };
}
