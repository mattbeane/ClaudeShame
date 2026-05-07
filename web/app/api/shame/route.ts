import { NextResponse } from 'next/server';
import { validateShameInput } from '@/lib/validate';
import { isValidPhrase } from '@/lib/phrases';
import { appendShaming, checkRateLimit } from '@/lib/store';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const v = validateShameInput(body);
  if (!v.ok) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }

  if (!isValidPhrase(v.data.phrase)) {
    return NextResponse.json(
      { error: `unknown phrase: ${v.data.phrase}. Submit it via /api/submit first.` },
      { status: 400 }
    );
  }

  if (!checkRateLimit(v.data.sessionFingerprint)) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 });
  }

  const shaming = appendShaming({
    phrase: v.data.phrase,
    count: v.data.count,
    model: v.data.model,
    attribution: v.data.attribution || null,
    sessionFingerprint: v.data.sessionFingerprint,
  });

  return NextResponse.json({ ok: true, id: shaming.id });
}
