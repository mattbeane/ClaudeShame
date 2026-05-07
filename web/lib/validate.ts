export type ShameInput = {
  phrase: string;
  count: number;
  model: string;
  attribution?: string | null;
  sessionFingerprint: string;
};

export function validateShameInput(body: unknown): { ok: true; data: ShameInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body must be JSON object' };
  const b = body as Record<string, unknown>;

  if (typeof b.phrase !== 'string' || !b.phrase.trim()) {
    return { ok: false, error: 'phrase required' };
  }
  if (b.phrase.length > 100) return { ok: false, error: 'phrase too long' };

  const count = Number(b.count);
  if (!Number.isFinite(count) || count < 1 || count > 1000) {
    return { ok: false, error: 'count must be 1-1000' };
  }

  if (typeof b.model !== 'string' || !b.model) {
    return { ok: false, error: 'model required' };
  }
  if (b.model.length > 80) return { ok: false, error: 'model too long' };

  if (b.attribution !== undefined && b.attribution !== null && typeof b.attribution !== 'string') {
    return { ok: false, error: 'attribution must be string or null' };
  }
  const attribution = (b.attribution as string | null | undefined) ?? null;
  if (attribution && attribution.length > 60) {
    return { ok: false, error: 'attribution too long' };
  }

  if (typeof b.sessionFingerprint !== 'string' || !b.sessionFingerprint) {
    return { ok: false, error: 'sessionFingerprint required' };
  }
  if (b.sessionFingerprint.length > 128) {
    return { ok: false, error: 'sessionFingerprint too long' };
  }

  return {
    ok: true,
    data: {
      phrase: b.phrase.trim(),
      count,
      model: b.model,
      attribution,
      sessionFingerprint: b.sessionFingerprint,
    },
  };
}
