import { NextResponse } from 'next/server';
import { appendPending, isValidPhrase } from '@/lib/phrases';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const TROPES_URL = 'https://tropes.fyi/tropes-md';

export async function GET(req: Request) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  let md: string;
  try {
    const res = await fetch(TROPES_URL, {
      headers: { 'user-agent': 'ClaudeShame/0.1 (+https://claudeshame.vercel.app)' },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `fetch HTTP ${res.status}` }, { status: 502 });
    }
    md = await res.text();
  } catch (e) {
    return NextResponse.json({ ok: false, error: `fetch failed: ${(e as Error).message}` }, { status: 502 });
  }

  // tropes.fyi serves the markdown verbatim inside HTML — decode entities so the
  // existing quote-matching regex works against the embedded plain text.
  md = md
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  const wordChoiceMatch = md.match(/##\s+Word Choice([\s\S]*?)(?=\n##\s+|$)/i);
  if (!wordChoiceMatch) {
    return NextResponse.json({ ok: false, error: 'word choice section not found in tropes-md' }, { status: 500 });
  }
  const section = wordChoiceMatch[1];

  const candidates = new Set<string>();

  for (const m of section.matchAll(/^###\s+"([^"]{1,40})"/gm)) {
    candidates.add(m[1].toLowerCase().trim());
  }

  for (const m of section.matchAll(/"([a-zA-Z][a-zA-Z\- ]{1,30})"/g)) {
    const word = m[1].toLowerCase().trim();
    if (word.length > 1 && word.length <= 30 && !word.includes(' delve ')) {
      candidates.add(word);
    }
  }

  // Filter junk: too-common verbs/articles, too-short, too-long-to-be-a-tic, known bad
  const STOP_LIST = new Set([
    'and friends', 'serves as', 'stands as', 'avoid patterns like',
    'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'and', 'or', 'but', 'the', 'a', 'an', 'of', 'to', 'in', 'on', 'at',
    'i', 'you', 'we', 'they', 'it', 'this', 'that',
  ]);
  const newCandidates: string[] = [];
  for (const phrase of candidates) {
    if (phrase.length < 3) continue;
    const wordCount = phrase.trim().split(/\s+/).length;
    if (wordCount > 4) continue;
    if (STOP_LIST.has(phrase)) continue;
    if (isValidPhrase(phrase)) continue;
    newCandidates.push(phrase);
  }

  let added = 0;
  for (const phrase of newCandidates) {
    const wasNew = await appendPending(phrase, 'tropes.fyi');
    if (wasNew) added++;
  }

  return NextResponse.json({
    ok: true,
    fetched: candidates.size,
    notInActive: newCandidates.length,
    added,
    candidates: newCandidates,
  });
}
