import { NextResponse } from 'next/server';
import { getFeed } from '@/lib/store';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(200, parseInt(searchParams.get('limit') || '20', 10) || 20));
  const shamings = getFeed(limit);
  return NextResponse.json({ shamings });
}
