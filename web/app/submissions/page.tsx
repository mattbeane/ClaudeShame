import { getPending } from '@/lib/phrases';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

export default async function Page() {
  const pending = await getPending();
  pending.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));

  const bySource = pending.reduce<Record<string, number>>((acc, p) => {
    const k = p.source || 'community';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  return (
    <main>
      <header className="site-head">
        <h1>Claude Shame</h1>
        <p className="tagline">When Claude tics, Claude pays.</p>
        <nav className="site-nav">
          <Link href="/">chalkboard</Link>
          <Link href="/leaderboard">leaderboard</Link>
          <Link href="/submissions" className="active">submissions</Link>
        </nav>
      </header>

      <div className="lb-frame">
        <div className="lb-board">
          {pending.length === 0 ? (
            <div className="bart-empty">
              <div className="big">No pending submissions.</div>
              <div className="small">Submit one with <code>zp submit "your phrase"</code>.</div>
            </div>
          ) : (
            <>
              <div className="submissions-summary">
                {Object.entries(bySource).map(([src, n]) => (
                  <span key={src} className="src-pill">{src} <strong>{n}</strong></span>
                ))}
              </div>
              <div className="logbook submissions-log">
                {pending.map((p, i) => (
                  <div key={`${p.phrase}-${i}`} className="log-entry">
                    <span className="phrase">"{p.phrase}"</span>
                    {p.source && <span className="source-tag">via {p.source}</span>}
                    <span className="meta">{formatDate(p.submittedAt)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="site-foot">
        <p>
          The moderation queue. Approved phrases land in{' '}
          <code><a href="https://github.com/mattbeane/ClaudeShame/blob/main/web/data/phrases.json">web/data/phrases.json</a></code> via PR.
          Sources: community submissions (<code>zp submit</code>) and a daily pull from{' '}
          <a href="https://tropes.fyi" target="_blank" rel="noreferrer">tropes.fyi</a>.
        </p>
      </footer>
    </main>
  );
}
