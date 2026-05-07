import { NextResponse } from 'next/server';
import { appendPending } from '@/lib/phrases';
import { rateLimit } from '@/lib/store';

function getClientIP(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function POST(req: Request) {
  const ip = getClientIP(req);
  if (!(await rateLimit(`cs:rate:submit:ip:${ip}`, 5, 60))) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 });
  }
  if (!(await rateLimit('cs:rate:submit:global', 30, 60))) {
    return NextResponse.json({ error: 'rate limited (global)' }, { status: 429 });
  }

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
  if (phrase.length < 2) return NextResponse.json({ error: 'phrase too short' }, { status: 400 });

  const accepted = await appendPending(phrase);
  if (!accepted) {
    return NextResponse.json({ ok: true, dedup: true });
  }
  return NextResponse.json({ ok: true });
}
