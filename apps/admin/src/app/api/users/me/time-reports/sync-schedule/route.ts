import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '../../../../../../lib/supabase/server';
import { requireUser } from '../../../../../../lib/auth/guards';
import { syncScheduleForTrainer } from '../../../../../../lib/time-reports';

export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  if (auth.role !== 'trainer') {
    return NextResponse.json({ success: false, error: 'Endast tränare kan synka egna pass' }, { status: 403 });
  }

  const body = await request.json();
  const date = body?.date as string | undefined;
  if (!date) {
    return NextResponse.json({ success: false, error: 'Datum krävs' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: trainer } = await supabase
    .from('users')
    .select('id, trainer_club_id')
    .eq('id', auth.user.id)
    .single();

  if (!trainer?.trainer_club_id) {
    return NextResponse.json({ success: false, error: 'Ingen tränarklubb är kopplad till ditt konto' }, { status: 400 });
  }

  try {
    const data = await syncScheduleForTrainer({
      userId: auth.user.id,
      clubId: trainer.trainer_club_id as string,
      date,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kunde inte synka dina pass';
    const status = message === 'Trainer not found' ? 404 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
