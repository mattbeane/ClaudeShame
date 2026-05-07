import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const CANDIDATES = [
  join(process.cwd(), 'data', 'phrases.json'),
  join(process.cwd(), '..', 'data', 'phrases.json'),
];

const PENDING_CANDIDATES = [
  join(process.cwd(), 'data', 'pending.json'),
  join(process.cwd(), '..', 'data', 'pending.json'),
];

function findPath(candidates: string[]): string | null {
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

export type PhraseEntry = { phrase: string; regex: string; addedAt: string };

export function loadPhrases(): { version: number; updatedAt: string; phrases: PhraseEntry[] } {
  const p = findPath(CANDIDATES);
  if (!p) return { version: 0, updatedAt: '', phrases: [] };
  return JSON.parse(readFileSync(p, 'utf-8'));
}

export function isValidPhrase(phrase: string): boolean {
  const { phrases } = loadPhrases();
  return phrases.some((e) => e.phrase === phrase);
}

export function appendPending(phrase: string): void {
  const p = findPath(PENDING_CANDIDATES);
  if (!p) return;
  const data = JSON.parse(readFileSync(p, 'utf-8'));
  data.submissions = data.submissions || [];
  if (data.submissions.some((s: { phrase: string }) => s.phrase === phrase)) return;
  data.submissions.push({ phrase, submittedAt: new Date().toISOString() });
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2));
}
