import { NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/store';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const winRaw = searchParams.get('window') || 'all-time';
  const win = (['all-time', 'week', 'by-model'] as const).includes(winRaw as never)
    ? (winRaw as 'all-time' | 'week' | 'by-model')
    : 'all-time';

  const entries = getLeaderboard(win);
  return NextResponse.json({ window: win, entries });
}
