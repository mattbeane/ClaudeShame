import { getFeed } from '@/lib/store';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toISOString().split('T')[0];
}

export default function Page() {
  const shamings = getFeed(50);

  return (
    <main>
      <header>
        <h1>Zeitgeist Police</h1>
        <p className="tagline">When Claude tics, Claude pays.</p>
        <nav>
          <Link href="/" className="active">chalkboard</Link>
          <Link href="/leaderboard">leaderboard</Link>
        </nav>
      </header>

      {shamings.length === 0 ? (
        <div className="empty">
          The chalkboard is clean.<br />
          (For now.)
        </div>
      ) : (
        <div className="feed">
          {shamings.map((s) => (
            <div key={s.id} className="shaming">
              <span className="phrase">"{s.phrase}"</span>
              <span className="count">×{s.count}</span>
              <span className="model">{s.model}</span>
              <span className="meta">
                {s.attribution || 'anonymous'} · {formatTime(s.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}

      <footer>
        <p>
          Phrases are curated. Submit one via{' '}
          <code>zp submit &quot;your phrase&quot;</code> or open a PR.
        </p>
      </footer>
    </main>
  );
}
