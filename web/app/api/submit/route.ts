import { NextResponse } from 'next/server';
import { appendPending } from '@/lib/phrases';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  const phrase = (body && typeof body === 'object' && 'phrase' in body
    ? String((body as { phrase: unknown }).phrase || '')
    : '').trim();

  if (!phrase) return NextResponse.json({ error: 'phrase required' }, { status: 400 });
  if (phrase.length > 100) return NextResponse.json({ error: 'phrase too long' }, { status: 400 });

  await appendPending(phrase);
  return NextResponse.json({ ok: true });
}
