import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { Redis } from '@upstash/redis';
import phrasesJson from '../data/phrases.json';

export type PhraseEntry = { phrase: string; regex: string; addedAt: string };
export type PhrasesDoc = { version: number; updatedAt: string; phrases: PhraseEntry[] };
export type PendingEntry = { phrase: string; submittedAt: string; source?: string };

const PENDING_KEY = 'cs:pending';
const PENDING_CANDIDATES = [
  join(process.cwd(), 'data', 'pending.json'),
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

function parsePending(item: unknown): PendingEntry | null {
  if (typeof item === 'string') {
    try { return JSON.parse(item) as PendingEntry; } catch { return null; }
  }
  if (item && typeof item === 'object' && 'phrase' in item) return item as PendingEntry;
  return null;
}

export async function getPending(): Promise<PendingEntry[]> {
  const r = getRedis();
  if (r) {
    const items = (await r.lrange(PENDING_KEY, 0, -1)) as unknown[];
    return items.map(parsePending).filter((x): x is PendingEntry => x !== null);
  }
  const p = findPath(PENDING_CANDIDATES);
  if (!p) return [];
  try {
    const data = JSON.parse(readFileSync(p, 'utf-8'));
    return (data.submissions || []) as PendingEntry[];
  } catch {
    return [];
  }
}

const PENDING_MAX = 500;

export async function appendPending(phrase: string, source?: string): Promise<boolean> {
  const entry: PendingEntry = {
    phrase,
    submittedAt: new Date().toISOString(),
    ...(source ? { source } : {}),
  };

  const r = getRedis();
  if (r) {
    const len = await r.llen(PENDING_KEY);
    if (len >= PENDING_MAX) return false;
    const existing = (await r.lrange(PENDING_KEY, 0, -1)) as unknown[];
    const seen = existing.some((item) => {
      const parsed = parsePending(item);
      return parsed?.phrase === phrase;
    });
    if (seen) return false;
    await r.rpush(PENDING_KEY, JSON.stringify(entry));
    return true;
  }

  const p = findPath(PENDING_CANDIDATES);
  if (!p) return false;
  const data = JSON.parse(readFileSync(p, 'utf-8'));
  data.submissions = data.submissions || [];
  if (data.submissions.length >= PENDING_MAX) return false;
  if (data.submissions.some((s: { phrase: string }) => s.phrase === phrase)) return false;
  data.submissions.push(entry);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2));
  return true;
}

/**
 * Replace the entire pending list with the given entries. Used by the
 * cron's cleanup pass to remove entries that fail the current filter.
 */
export async function replacePending(entries: PendingEntry[]): Promise<void> {
  const r = getRedis();
  if (r) {
    await r.del(PENDING_KEY);
    if (entries.length > 0) {
      await r.rpush(PENDING_KEY, ...entries.map((e) => JSON.stringify(e)));
    }
    return;
  }
  const p = findPath(PENDING_CANDIDATES);
  if (!p) return;
  const data = JSON.parse(readFileSync(p, 'utf-8'));
  data.submissions = entries;
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2));
}

function findPath(candidates: string[]): string | null {
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}
