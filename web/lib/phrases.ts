import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { Redis } from '@upstash/redis';
import phrasesJson from '../../data/phrases.json';

export type PhraseEntry = { phrase: string; regex: string; addedAt: string };
export type PhrasesDoc = { version: number; updatedAt: string; phrases: PhraseEntry[] };

const PENDING_KEY = 'cs:pending';
const PENDING_CANDIDATES = [
  join(process.cwd(), 'data', 'pending.json'),
  join(process.cwd(), '..', 'data', 'pending.json'),
];

function getRedis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function loadPhrases(): PhrasesDoc {
  return phrasesJson as PhrasesDoc;
}

export function isValidPhrase(phrase: string): boolean {
  return (phrasesJson as PhrasesDoc).phrases.some((e) => e.phrase === phrase);
}

export async function appendPending(phrase: string): Promise<void> {
  const r = getRedis();
  if (r) {
    const existing = (await r.lrange(PENDING_KEY, 0, -1)) as unknown[];
    const seen = existing.some((item) => {
      const parsed = typeof item === 'string' ? safeParse(item) : item;
      return parsed && typeof parsed === 'object' && (parsed as { phrase?: string }).phrase === phrase;
    });
    if (seen) return;
    await r.rpush(PENDING_KEY, JSON.stringify({ phrase, submittedAt: new Date().toISOString() }));
    return;
  }

  const p = findPath(PENDING_CANDIDATES);
  if (!p) return;
  const data = JSON.parse(readFileSync(p, 'utf-8'));
  data.submissions = data.submissions || [];
  if (data.submissions.some((s: { phrase: string }) => s.phrase === phrase)) return;
  data.submissions.push({ phrase, submittedAt: new Date().toISOString() });
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2));
}

function findPath(candidates: string[]): string | null {
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}
