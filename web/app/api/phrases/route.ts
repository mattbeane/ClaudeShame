import { NextResponse } from 'next/server';
import { loadPhrases } from '@/lib/phrases';

export async function GET() {
  const data = loadPhrases();
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
  });
}
