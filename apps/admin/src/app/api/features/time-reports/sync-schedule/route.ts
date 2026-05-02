import { NextRequest, NextResponse } from 'next/server';
import { requireClubAccess } from '../../../../../lib/auth/guards';
import { syncScheduleForTrainer } from '../../../../../lib/time-reports';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const userId = body?.userId as string | undefined;
  const clubId = body?.clubId as string | undefined;
  const date = body?.date as string | undefined;

  if (!userId || !clubId || !date) {
    return NextResponse.json({ success: false, error: 'userId, clubId and date are required' }, { status: 400 });
  }

  const access = await requireClubAccess(clubId);
  if (!access.ok) return access.response;

  try {
    const data = await syncScheduleForTrainer({ userId, clubId, date });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kunde inte synka tidrapporter';
    const status = message === 'Trainer not found' ? 404 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
